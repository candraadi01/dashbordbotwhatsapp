"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type PushStatus =
  | "unsupported"   // Browser tidak support push
  | "checking"      // Sedang cek status
  | "denied"        // User menolak izin
  | "granted"       // Sudah aktif
  | "default"       // Belum ada keputusan
  | "loading";      // Sedang proses subscribe/unsubscribe

const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ??
  "BIeAb1LsZdKrM13UHs8VIRROEYd3c7TZRU1z8jq2yKqLS0WQ0f-N8HT3B3cPWWLcT-LNDxBrFfDB0V9JlWyA2Dg";

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer;
}

async function getAuthToken(): Promise<string> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  } catch {
    return "";
  }
}

export function usePushNotification() {
  const [status, setStatus] = useState<PushStatus>("checking");
  const [endpoint, setEndpoint] = useState<string | null>(null);

  const isSupported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    Boolean(VAPID_PUBLIC_KEY);

  // ── Cek status awal ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isSupported) {
      setStatus("unsupported");
      return;
    }

    async function checkStatus() {
      try {
        const permission = Notification.permission;
        if (permission === "denied") {
          setStatus("denied");
          return;
        }

        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();

        if (sub) {
          setEndpoint(sub.endpoint);
          setStatus("granted");
        } else if (permission === "granted") {
          setStatus("default");
        } else {
          setStatus("default");
        }
      } catch {
        setStatus("default");
      }
    }

    void checkStatus();
  }, [isSupported]);

  // ── Subscribe ─────────────────────────────────────────────────────────────────
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;
    setStatus("loading");
    try {
      // 1. Minta izin notifikasi
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "default");
        return false;
      }

      // 2. Daftarkan service worker
      const reg = await navigator.serviceWorker.ready;

      // 3. Subscribe ke push
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // 4. Kirim subscription ke server
      const token = await getAuthToken();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(sub.toJSON()),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Gagal menyimpan subscription ke database");
      }

      setEndpoint(sub.endpoint);
      setStatus("granted");

      // Tampilkan feedback instan langsung di layar HP
      try {
        void reg.showNotification("🔔 Notifikasi HP Aktif!", {
          body: "HP Anda siap menerima notifikasi transaksi secara realtime.",
          icon: "/icons/icon-192.png",
          badge: "/icons/icon-192.png",
          vibrate: [200, 100, 200],
          tag: "candra-push-active",
        } as any);
      } catch (_) {}

      return true;
    } catch (err) {
      console.error("[usePushNotification] subscribe error:", err);
      try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (existing) {
          setEndpoint(existing.endpoint);
          setStatus("granted");
          return true;
        }
      } catch {
        /* ignore */
      }
      setStatus("default");
      return false;
    }
  }, [isSupported]);

  // ── Unsubscribe ───────────────────────────────────────────────────────────────
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;
    setStatus("loading");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();

      if (sub) {
        // Hapus dari server
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        // Hapus dari browser
        await sub.unsubscribe();
      }

      setEndpoint(null);
      setStatus("default");
      return true;
    } catch (err) {
      console.error("[usePushNotification] unsubscribe error:", err);
      setStatus("granted"); // revert
      return false;
    }
  }, [isSupported]);

  // ── Kirim tes notifikasi Web Push ─────────────────────────────────────────────
  const sendTestNotification = useCallback(async (options?: { soundUrl?: string }): Promise<{ success: boolean; message?: string }> => {
    try {
      const soundUrl = options?.soundUrl || "/api/notifications/sound";
      const res = await fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "🔔 Tes Notifikasi HP Berhasil!",
          body: "Web Push bekerja realtime di layar HP Anda.",
          url: "/dashboard/transactions",
          sound: soundUrl,
        }),
      });
      const data = await res.json().catch(() => ({}));

      // Jika belum ada subscriber push sama sekali, tampilkan notifikasi lokal fallback
      if (data.sent === 0 && "serviceWorker" in navigator) {
        navigator.serviceWorker.ready.then((reg) => {
          void reg.showNotification("🔔 Tes Notifikasi HP Berhasil!", {
            body: "Web Push belum terdaftar. Notifikasi lokal berhasil diuji.",
            icon: "/icons/icon-192.png",
            badge: "/icons/icon-192.png",
            silent: true,
            tag: "candra-test-notif",
          } as any);
        });
      }

      if (!res.ok) throw new Error(data.error || "Gagal mengirim tes notifikasi.");
      return { success: true, message: `Terkirim ke ${data.sent || 1} perangkat.` };
    } catch (err: any) {
      return { success: false, message: err.message || "Gagal mengirim notifikasi tes." };
    }
  }, []);

  // ── Minta izin browser secara langsung ───────────────────────────────────────
  const requestPermission = useCallback(async (): Promise<string> => {
    if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
    try {
      const result = await Notification.requestPermission();
      setStatus(result === "granted" ? "granted" : result === "denied" ? "denied" : "default");
      return result;
    } catch {
      return "denied";
    }
  }, []);

  // ── Tampilkan notifikasi lokal ────────────────────────────────────────────────
  const sendNotification = useCallback((options: { title: string; body: string; tag?: string; data?: any; sound?: string }): boolean => {
    if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") {
      return false;
    }
    try {
      const soundUrl = options.sound || "/api/notifications/sound";
      // silent: true wajib agar sistem OS/Android tidak membunyikan nada default OS
      // bersamaan dengan Web Audio API custom
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.ready.then((reg) => {
          void reg.showNotification(options.title, {
            body: options.body,
            icon: "/icons/icon-192.png",
            badge: "/icons/icon-192.png",
            tag: options.tag,
            data: options.data,
            sound: soundUrl,
            silent: true,
            vibrate: [300, 100, 300, 100, 300],
          } as any);
        }).catch(() => {
          new Notification(options.title, { body: options.body, icon: "/icons/icon-192.png", tag: options.tag, silent: true } as any);
        });
      } else {
        new Notification(options.title, { body: options.body, icon: "/icons/icon-192.png", tag: options.tag, silent: true } as any);
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  return {
    status,
    endpoint,
    isSupported,
    isGranted: status === "granted",
    isDenied: status === "denied",
    isLoading: status === "loading",
    isSubscribed: status === "granted",
    permissionState: (typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "unsupported") as "default" | "granted" | "denied" | "unsupported",
    subscribe,
    unsubscribe,
    subscribeToPush: subscribe,
    unsubscribeFromPush: unsubscribe,
    sendTestNotification,
    requestPermission,
    sendNotification,
  };
}
