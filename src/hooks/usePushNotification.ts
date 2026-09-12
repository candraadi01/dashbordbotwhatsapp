/**
 * usePushNotification
 *
 * Menggunakan browser Notification API untuk menampilkan notifikasi OS
 * (muncul di latar belakang / saat tab tidak aktif). Tidak memerlukan
 * server VAPID karena dashboard ini single-user.
 */

import { useCallback, useEffect, useState } from "react";

export type PermissionState = "default" | "granted" | "denied" | "unsupported";

export interface OsNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

export function usePushNotification() {
  const [permissionState, setPermissionState] = useState<PermissionState>("unsupported");

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermissionState("unsupported");
      return;
    }
    setPermissionState(Notification.permission as PermissionState);
  }, []);

  /** Minta izin notifikasi OS dari browser */
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

  /** Kirim notifikasi OS — gunakan SW jika tersedia untuk tampilan background lebih baik */
  const sendNotification = useCallback((options: OsNotificationOptions): boolean => {
    if (
      typeof window === "undefined" ||
      !("Notification" in window) ||
      Notification.permission !== "granted"
    ) {
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
          });
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
    requestPermission,
    sendNotification,
  };
}
