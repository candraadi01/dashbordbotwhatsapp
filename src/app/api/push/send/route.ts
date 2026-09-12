import { NextRequest, NextResponse } from "next/server";
import { sendWebPushToAll } from "@/lib/webPush";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    let title = "Transaksi Baru!";
    let messageBody = "Ada transaksi baru yang masuk ke bot WhatsApp.";
    let url = "/dashboard/transactions";
    let transactionId: string | undefined = undefined;

    // 1. Cek jika dipicu oleh Supabase Database Webhook (INSERT / UPDATE)
    if (body && typeof body === "object" && body.record) {
      const rec = body.record;
      const eventType = body.type || "INSERT";

      if (eventType === "INSERT") {
        const customer = rec.customer_name || "Pelanggan";
        const product = rec.product_name || "Produk";
        const priceFormatted = Number.isFinite(Number(rec.price))
          ? `Rp ${Number(rec.price).toLocaleString("id-ID")}`
          : "";
        const code = rec.transaction_id || rec.id;

        title = `🛒 Transaksi Baru: ${customer}`;
        messageBody = `${product}${priceFormatted ? ` (${priceFormatted})` : ""} · ${code}`;
        url = `/dashboard/transactions?edit=${encodeURIComponent(code)}`;
        transactionId = code;
      } else if (eventType === "UPDATE") {
        const oldRec = body.old_record || {};
        if (oldRec.status === rec.status) {
          // Tidak ada perubahan status, abaikan
          return NextResponse.json({ message: "No status change ignored" });
        }
        const statusLabel =
          rec.status === "success" ? "Berhasil" : rec.status === "cancelled" ? "Gagal" : "Pending";
        const code = rec.transaction_id || rec.id;

        title = `Status Transaksi: ${statusLabel}`;
        messageBody = `${rec.customer_name || "Pelanggan"} · ${rec.product_name || "Produk"} (${code})`;
        url = `/dashboard/transactions?edit=${encodeURIComponent(code)}`;
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
