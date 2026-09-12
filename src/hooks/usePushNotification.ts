"use client";

import { useCallback, useEffect, useState } from "react";

export type PermissionState = "default" | "granted" | "denied" | "unsupported";

export interface OsNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const DEFAULT_VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  "BIeAb1LsZdKrM13UHs8VIRROEYd3c7TZRU1z8jq2yKqLS0WQ0f-N8HT3B3cPWWLcT-LNDxBrFfDB0V9JlWyA2Dg";

export function usePushNotification() {
  const [permissionState, setPermissionState] = useState<PermissionState>("unsupported");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Periksa izin dan status subscription saat mount
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermissionState("unsupported");
      return;
    }

    setPermissionState(Notification.permission as PermissionState);

    // Periksa apakah sudah berlangganan PushManager
    if ("serviceWorker" in navigator && "PushManager" in window) {
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => {
          setIsSubscribed(Boolean(sub));
        })
        .catch(() => setIsSubscribed(false));
    }
  }, []);

  /** Minta izin notifikasi browser */
  const requestPermission = useCallback(async (): Promise<PermissionState> => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return "unsupported";
    }
    try {
      const result = await Notification.requestPermission();
      setPermissionState(result as PermissionState);
      return result as PermissionState;
    } catch {
      setPermissionState("denied");
      return "denied";
    }
  }, []);

  /** Mendaftar ke Web Push Server (VAPID + Service Worker) */
  const subscribeToPush = useCallback(
    async (publicKey = DEFAULT_VAPID_PUBLIC_KEY): Promise<boolean> => {
      if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        return false;
      }

      setIsLoading(true);
      try {
        // 1. Minta izin jika belum
        const permission = await Notification.requestPermission();
        setPermissionState(permission as PermissionState);
        if (permission !== "granted") {
          setIsLoading(false);
          return false;
        }

        // 2. Pastikan Service Worker terdaftar
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        await navigator.serviceWorker.ready;

        // 3. Daftarkan Push Subscription
        const convertedKey = urlBase64ToUint8Array(publicKey);
        let subscription = await reg.pushManager.getSubscription();
        if (!subscription) {
          subscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedKey as unknown as BufferSource,
          });
        }

        // 4. Kirim endpoint ke API server
        const response = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subscription: subscription.toJSON(),
            userAgent: navigator.userAgent,
          }),
        });

        if (!response.ok) {
          throw new Error("Gagal mendaftarkan subscription ke server");
        }

        setIsSubscribed(true);
        return true;
      } catch (err) {
        console.error("[usePushNotification] Subscribe error:", err);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /** Berhenti berlangganan Web Push */
  const unsubscribeFromPush = useCallback(async (): Promise<boolean> => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      return false;
    }

    setIsLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();

        // Beritahu server untuk menghapus subscription
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
      }
      setIsSubscribed(false);
      return true;
    } catch (err) {
      console.error("[usePushNotification] Unsubscribe error:", err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /** Kirim notifikasi tes langsung ke Web Push Server */
  const sendTestNotification = useCallback(async (): Promise<{ success: boolean; message?: string }> => {
    try {
      const response = await fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "🔔 Tes Notifikasi HP Berhasil!",
          body: "Web Push OS bekerja sempurna di latar belakang HP Anda meskipun browser ditutup.",
          url: "/dashboard/transactions",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal mengirim tes");
      return { success: true, message: `Terkirim ke ${data.result?.sent || 0} perangkat.` };
    } catch (err: any) {
      return { success: false, message: err.message || "Gagal mengirim notifikasi tes." };
    }
  }, []);

  /** Fallback pengiriman notifikasi lokal */
  const sendNotification = useCallback((options: OsNotificationOptions): boolean => {
    if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") {
      return false;
    }
    try {
      if ("serviceWorker" in navigator) {
        void navigator.serviceWorker.ready.then((reg) => {
          void reg.showNotification(options.title, {
            body: options.body,
            icon: options.icon ?? "/icons/icon-192.png",
            badge: "/icons/icon-192.png",
            tag: options.tag,
            data: options.data,
            vibrate: [200, 100, 200],
          } as any);
        });
      } else {
        new Notification(options.title, {
          body: options.body,
          icon: options.icon ?? "/icons/icon-192.png",
          tag: options.tag,
        });
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  return {
    permissionState,
    isSupported: permissionState !== "unsupported",
    isGranted: permissionState === "granted",
    isDenied: permissionState === "denied",
    isSubscribed,
    isLoading,
    requestPermission,
    subscribeToPush,
    unsubscribeFromPush,
    sendTestNotification,
    sendNotification,
  };
}
