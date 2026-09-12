import { NextRequest, NextResponse } from "next/server";
import { pushSubscriptionStore } from "@/lib/pushSubscriptionStore";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { subscription, userAgent } = body;

    if (!subscription || !subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return NextResponse.json(
        { error: "Payload subscription tidak valid" },
        { status: 400 }
      );
    }

    const ua = userAgent || req.headers.get("user-agent") || "";
    await pushSubscriptionStore.save(subscription, ua);

    return NextResponse.json({
      success: true,
      message: "Device berhasil didaftarkan untuk Web Push Notification.",
    });
  } catch (err: any) {
    console.error("[api/push/subscribe] Error:", err);
    return NextResponse.json(
      { error: err.message || "Gagal menyimpan subscription" },
      { status: 500 }
    );
  }
}
