import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { pushSubscriptionStore } from "@/lib/pushSubscriptionStore";

// Konfigurasi VAPID
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:admin@candradashboard.com";
const vapidPublicKey =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  "BIeAb1LsZdKrM13UHs8VIRROEYd3c7TZRU1z8jq2yKqLS0WQ0f-N8HT3B3cPWWLcT-LNDxBrFfDB0V9JlWyA2Dg";
const vapidPrivateKey =
  process.env.VAPID_PRIVATE_KEY || "13DhihR1yT9IL3HjX98kWy-U5m7U3pDQR6ihbvtWHW4";

try {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
} catch (e) {
  console.error("[push/send] VAPID configuration error:", e);
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function statusLabel(status: string) {
  if (status === "success") return "Berhasil ✅";
  if (status === "cancelled") return "Dibatalkan ❌";
  return "Menunggu konfirmasi ⏳";
}

// POST: dipanggil oleh Supabase Database Webhook atau langsung oleh bot / dashboard
export async function POST(req: NextRequest) {
  try {
    // 1. Verifikasi webhook secret (opsional, jika dikonfigurasi)
    const secret = process.env.PUSH_WEBHOOK_SECRET;
    if (secret) {
      const incoming =
        req.headers.get("x-webhook-secret") ||
        req.headers.get("authorization")?.replace("Bearer ", "") ||
        "";
      // Hanya verifikasi jika incoming header ada agar tidak memblokir webhook internal
      if (incoming && incoming !== secret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    // 2. Parse payload
    const body = await req.json().catch(() => ({}));

    let title = "CANDRA BOT";
    let message = "Ada aktivitas pesanan baru di toko Anda";
    let url = "/dashboard/transactions";
    let tag = `candra-txn-${Date.now()}`;

    // Payload dari Supabase Database Webhook (INSERT / UPDATE / DELETE)
    if (body.table === "transactions" || body.record || body.new || body.type === "DELETE" || body.type === "UPDATE") {
      const record = body.record || body.new;
      const oldRecord = body.old_record || body.old;
      const eventType = body.type || (body.eventType as string) || "INSERT";

      if (eventType === "DELETE") {
        const customer = oldRecord?.customer_name || "Pelanggan";
        const txId = oldRecord?.transaction_id || oldRecord?.id || "-";
        const product = oldRecord?.product_name || "Produk";
        title = "🗑️ Transaksi Dihapus";
        message = `Pesanan #${txId} (${product}) milik ${customer} telah dihapus.`;
        url = "/dashboard/transactions";
        tag = `candra-del-${txId}`;
      } else if (record) {
        const customer = record.customer_name || oldRecord?.customer_name || "Customer";
        const product = record.product_name || oldRecord?.product_name || "Produk";
        const txId = record.transaction_id || record.id || "-";
        const status = record.status || "pending";
        const priceFormatted = Number(record.price)
          ? ` (Rp ${Number(record.price).toLocaleString("id-ID")})`
          : "";

        if (eventType === "INSERT") {
          title = "🛒 Transaksi Baru Masuk!";
          message = `${customer} memesan ${product}${priceFormatted} · #${txId}`;
          tag = `candra-txn-${txId}`;
        } else if (eventType === "UPDATE") {
          const oldStatus = oldRecord?.status;
          if (oldStatus && oldStatus === status) {
            // Status tidak berubah → skip push agar tidak spam
            return NextResponse.json({ ok: true, skipped: true, reason: "status_unchanged" });
          }

          if (status === "cancelled") {
            title = "❌ Transaksi Dibatalkan";
            message = `Pesanan #${txId} (${product}) milik ${customer} telah dibatalkan.`;
          } else if (status === "success") {
            title = "✅ Pembayaran Berhasil";
            message = `Pesanan #${txId} (${product}) milik ${customer} telah dikonfirmasi berhasil.`;
          } else {
            title = "🔄 Status Transaksi Diperbarui";
            message = `#${txId} ${customer} → ${statusLabel(status)}`;
          }
          tag = `candra-status-${txId}`;
        }

        url = `/dashboard/transactions?edit=${encodeURIComponent(txId)}`;
      }
    } else if (body.title) {
      // Format manual (tes push dari tombol dashboard)
      title = body.title;
      message = body.body || message;
      url = body.url || url;
      tag = body.tag || tag;
    }

    // 3. Ambil semua subscriber dari Supabase
    const admin = getAdminClient();
    const map = new Map<string, { endpoint: string; p256dh: string; auth: string }>();

    try {
      const { data: dbSubscribers, error } = await admin
        .from("push_subscriptions" as any)
        .select("endpoint, p256dh, auth")
        .limit(500);

      if (!error && Array.isArray(dbSubscribers)) {
        for (const s of dbSubscribers as any[]) {
          if (s.endpoint && s.p256dh && s.auth) {
            map.set(s.endpoint, { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth });
          }
        }
      }
    } catch (dbErr) {
      console.warn("[push/send] Supabase query warning:", dbErr);
    }

    // Gabungkan dengan store lokal jika ada
    try {
      const localSubs = await pushSubscriptionStore.getAll();
      for (const s of localSubs) {
        if (s.endpoint && s.keys?.p256dh && s.keys?.auth && !map.has(s.endpoint)) {
          map.set(s.endpoint, {
            endpoint: s.endpoint,
            p256dh: s.keys.p256dh,
            auth: s.keys.auth,
          });
        }
      }
    } catch {
      /* ignore */
    }

    const subscribers = Array.from(map.values());

    if (subscribers.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, message: "Belum ada subscriber terdaftar." });
    }

    // 4. Kirim notifikasi native Web Push ke semua subscriber
    // Catatan: Payload Web Push dibatasi maksimal 4096 byte, jadi selalu gunakan URL suara (/api/notifications/sound)
    const soundUrl =
      typeof body.sound === "string" && !body.sound.startsWith("data:")
        ? body.sound
        : "/api/notifications/sound";

    const payload = JSON.stringify({
      title,
      body: message,
      url,
      tag,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      sound: soundUrl,
      timestamp: Date.now(),
    });

    const staleEndpoints: string[] = [];

    const results = await Promise.allSettled(
      subscribers.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload,
            {
              TTL: 60 * 60 * 24, // 24 jam
              urgency: "high",
            }
          );
        } catch (err: any) {
          const statusCode = err?.statusCode;
          if (statusCode === 410 || statusCode === 404) {
            staleEndpoints.push(sub.endpoint);
          } else {
            throw err;
          }
        }
      })
    );

    // Hapus subscription yang sudah kadaluarsa dari database
    if (staleEndpoints.length > 0) {
      try {
        await admin.from("push_subscriptions" as any).delete().in("endpoint", staleEndpoints);
        await pushSubscriptionStore.removeMany(staleEndpoints);
      } catch {
        /* ignore */
      }
    }

    const sent = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    console.log(`[push/send] Sent: ${sent}, Failed: ${failed}, Stale: ${staleEndpoints.length}`);
    return NextResponse.json({ ok: true, sent, failed, stale: staleEndpoints.length });
  } catch (err: any) {
    console.error("[push/send POST]", err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
