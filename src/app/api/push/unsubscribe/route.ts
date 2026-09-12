import { NextRequest, NextResponse } from "next/server";
import { pushSubscriptionStore } from "@/lib/pushSubscriptionStore";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { endpoint } = body;

    if (!endpoint) {
      return NextResponse.json(
        { error: "Endpoint subscription wajib diisi" },
        { status: 400 }
      );
    }

    await pushSubscriptionStore.remove(endpoint);

    return NextResponse.json({
      success: true,
      message: "Subscription berhasil dihapus.",
    });
  } catch (err: any) {
    console.error("[api/push/unsubscribe] Error:", err);
    return NextResponse.json(
      { error: err.message || "Gagal menghapus subscription" },
      { status: 500 }
    );
  }
}
