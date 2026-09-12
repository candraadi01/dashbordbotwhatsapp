import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { pushSubscriptionStore } from "@/lib/pushSubscriptionStore";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// GET: cek apakah endpoint ini sudah terdaftar
export async function GET(req: NextRequest) {
  const endpoint = req.nextUrl.searchParams.get("endpoint");
  if (!endpoint) return NextResponse.json({ subscribed: false });
  try {
    const admin = getAdminClient();
    const { data } = await admin
      .from("push_subscriptions" as any)
      .select("id")
      .eq("endpoint", endpoint)
      .maybeSingle();
    return NextResponse.json({ subscribed: Boolean(data) });
  } catch {
    return NextResponse.json({ subscribed: false });
  }
}

// POST: simpan subscription baru ke Supabase
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sub = body.subscription || body;
    const endpoint = sub.endpoint;
    const keys = sub.keys;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json(
        { error: "Data subscription tidak lengkap" },
        { status: 400 }
      );
    }

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();

    let userId: string | null = null;
    if (token) {
      try {
        const anonClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { data: userData } = await anonClient.auth.getUser(token);
        userId = userData?.user?.id ?? null;
      } catch {
        /* ignore */
      }
    }

    const admin = getAdminClient();
    const userAgent = req.headers.get("user-agent") ?? "";

    // Simpan ke Supabase database
    const { error } = await admin.from("push_subscriptions" as any).upsert(
      {
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        user_agent: userAgent,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" }
    );

    if (error) {
      console.warn("[push/subscribe POST] Supabase upsert error:", error.message);
    }

    // Juga simpan ke pushSubscriptionStore lokal sebagai backup
    await pushSubscriptionStore.save({ endpoint, keys }, userAgent);

    return NextResponse.json({ ok: true, success: true });
  } catch (err: any) {
    console.error("[push/subscribe POST]", err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

// DELETE: hapus subscription (unsubscribe)
export async function DELETE(req: NextRequest) {
  try {
    const { endpoint } = await req.json();
    if (!endpoint) {
      return NextResponse.json({ error: "endpoint wajib diisi" }, { status: 400 });
    }

    const admin = getAdminClient();
    await admin.from("push_subscriptions" as any).delete().eq("endpoint", endpoint);
    await pushSubscriptionStore.remove(endpoint);

    return NextResponse.json({ ok: true, success: true });
  } catch (err: any) {
    console.error("[push/subscribe DELETE]", err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
