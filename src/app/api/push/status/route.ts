import { NextResponse } from "next/server";
import { vapidPublicKey } from "@/lib/webPush";
import { pushSubscriptionStore } from "@/lib/pushSubscriptionStore";

export async function GET() {
  try {
    const subscriptions = await pushSubscriptionStore.getAll();
    return NextResponse.json({
      vapidConfigured: Boolean(vapidPublicKey),
      vapidPublicKey,
      subscriptionsCount: subscriptions.length,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to get push status" },
      { status: 500 }
    );
  }
}
