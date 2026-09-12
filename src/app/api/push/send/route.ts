import { NextRequest, NextResponse } from "next/server";
import { sendWebPushToAll } from "@/lib/webPush";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    let title = "Transaksi Baru!";
    let messageBody = "Ada transaksi baru yang masuk ke bot WhatsApp.";
    let url = "/dashboard/transactions";
    let transactionId: string | undefined = undefined;

    // 1. Cek jika dipicu oleh Supabase Database Webhook (INSERT / UPDATE / DELETE)
    if (body && typeof body === "object" && (body.record || body.type === "DELETE" || body.type === "UPDATE")) {
      const rec = body.record || {};
      const oldRec = body.old_record || {};
      const eventType = body.type || "INSERT";

      if (eventType === "INSERT") {
        const customer = rec.customer_name || "Pelanggan";
        const product = rec.product_name || "Produk";
        const priceFormatted = Number.isFinite(Number(rec.price))
          ? `Rp ${Number(rec.price).toLocaleString("id-ID")}`
          : "";
        const code = rec.transaction_id || rec.id || "-";

        title = `🛒 Transaksi Baru: ${customer}`;
        messageBody = `${product}${priceFormatted ? ` (${priceFormatted})` : ""} · ID: ${code}`;
        url = `/dashboard/transactions?edit=${encodeURIComponent(code)}`;
        transactionId = code;
      } else if (eventType === "UPDATE") {
        if (oldRec.status && rec.status && oldRec.status === rec.status) {
          // Tidak ada perubahan status, abaikan agar tidak spam
          return NextResponse.json({ message: "No status change ignored" });
        }

        const customer = rec.customer_name || oldRec.customer_name || "Pelanggan";
        const product = rec.product_name || oldRec.product_name || "Produk";
        const code = rec.transaction_id || rec.id || oldRec.transaction_id || "-";

        if (rec.status === "cancelled") {
          title = `❌ Transaksi Dibatalkan: ${customer}`;
          messageBody = `Pesanan ${code} (${product}) telah dibatalkan.`;
        } else if (rec.status === "success") {
          title = `✅ Pembayaran Berhasil: ${customer}`;
          messageBody = `Pesanan ${code} (${product}) telah dikonfirmasi berhasil.`;
        } else {
          title = `⏳ Status Transaksi Pending: ${customer}`;
          messageBody = `Pesanan ${code} (${product}) menunggu konfirmasi.`;
        }

        url = `/dashboard/transactions?edit=${encodeURIComponent(code)}`;
        transactionId = code;
      } else if (eventType === "DELETE") {
        const customer = oldRec.customer_name || "Pelanggan";
        const product = oldRec.product_name || "Produk";
        const code = oldRec.transaction_id || oldRec.id || "-";

        title = `🗑️ Transaksi Dihapus: ${customer}`;
        messageBody = `Pesanan ${code} (${product}) telah dihapus dari sistem.`;
        url = `/dashboard/transactions`;
        transactionId = code;
      }
    } else {
      // 2. Payload manual dari dashboard atau tes notifikasi
      if (body.title) title = String(body.title);
      if (body.body) messageBody = String(body.body);
      if (body.url) url = String(body.url);
      if (body.transactionId) transactionId = String(body.transactionId);
    }

    const result = await sendWebPushToAll({
      title,
      body: messageBody,
      url,
      transactionId,
    });

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (err: any) {
    console.error("[api/push/send] Error:", err);
    return NextResponse.json(
      { error: err.message || "Gagal mengirim notifikasi Web Push" },
      { status: 500 }
    );
  }
}
