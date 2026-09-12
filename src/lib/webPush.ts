import webpush from "web-push";
import { pushSubscriptionStore } from "./pushSubscriptionStore";

const vapidPublicKey =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  "BIeAb1LsZdKrM13UHs8VIRROEYd3c7TZRU1z8jq2yKqLS0WQ0f-N8HT3B3cPWWLcT-LNDxBrFfDB0V9JlWyA2Dg";
const vapidPrivateKey =
  process.env.VAPID_PRIVATE_KEY ||
  "13DhihR1yT9IL3HjX98kWy-U5m7U3pDQR6ihbvtWHW4";
const vapidSubject =
  process.env.VAPID_SUBJECT || "mailto:admin@candradashboard.com";

let vapidConfigured = false;
try {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  vapidConfigured = true;
} catch (err) {
  console.error("[webPush] Gagal menginisialisasi VAPID details:", err);
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  url?: string;
  transactionId?: string;
  icon?: string;
  badge?: string;
  tag?: string;
}

export async function sendWebPushToAll(payload: PushNotificationPayload) {
  if (!vapidConfigured) {
    try {
      webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
      vapidConfigured = true;
    } catch {
      return { total: 0, sent: 0, failed: 0, error: "VAPID keys not configured" };
    }
  }

  const subscriptions = await pushSubscriptionStore.getAll();
  if (subscriptions.length === 0) {
    return { total: 0, sent: 0, failed: 0, message: "No active push subscriptions" };
  }

  const payloadString = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || "/icons/icon-192.png",
    badge: payload.badge || "/icons/icon-192.png",
    url: payload.url || "/dashboard/transactions",
    transactionId: payload.transactionId || null,
    tag: payload.tag || `trx-${payload.transactionId || Date.now()}`,
    timestamp: Date.now(),
  });

  const expiredEndpoints: string[] = [];

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.keys.p256dh,
              auth: sub.keys.auth,
            },
          },
          payloadString,
          {
            TTL: 60 * 60 * 24, // 24 hours
            urgency: "high",
          }
        );
      } catch (err: any) {
        // Jika endpoint sudah kadaluarsa / unregistered dari browser (404 / 410)
        if (err.statusCode === 404 || err.statusCode === 410) {
          expiredEndpoints.push(sub.endpoint);
        }
        throw err;
      }
    })
  );

  // Bersihkan subscription yang sudah mati
  if (expiredEndpoints.length > 0) {
    void pushSubscriptionStore.removeMany(expiredEndpoints);
  }

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  return {
    total: subscriptions.length,
    sent,
    failed,
  };
}

export { webpush, vapidPublicKey };
