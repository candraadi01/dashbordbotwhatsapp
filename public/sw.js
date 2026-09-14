/* CANDRA BOT PWA Service Worker — push notification + offline shell */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

/* ──── Web Push Handler ──────────────────────────────────────────────────────── */
self.addEventListener("push", (event) => {
  let payload = {
    title: "CANDRA BOT",
    body: "Ada aktivitas pesanan baru masuk.",
    url: "/dashboard/transactions",
    sound: "/api/notifications/sound",
  };

  if (event.data) {
    try {
      payload = { ...payload, ...JSON.parse(event.data.text()) };
    } catch {
      payload.body = event.data.text();
    }
  }

  const soundUrl = payload.sound || "/api/notifications/sound";

  const options = {
    body: payload.body,
    icon: payload.icon || "/icons/icon-192.png",
    badge: payload.badge || "/icons/icon-192.png",
    image: payload.image || undefined,
    vibrate: [300, 100, 300, 100, 300],
    sound: soundUrl,
    tag: payload.tag || "candra-transaction",
    renotify: true,
    requireInteraction: false,
    data: { url: payload.url || "/dashboard/transactions", sound: soundUrl, timestamp: Date.now() },
    actions: [
      { action: "open", title: "Buka Dashboard" },
      { action: "dismiss", title: "Tutup" },
    ],
  };

  event.waitUntil(
    (async () => {
      let hasOpenClient = false;
      let clientList = [];
      try {
        clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        hasOpenClient = Boolean(clientList && clientList.length > 0);
      } catch (_) {}

      // PENTING UNTUK MENCEGAH SUARA DOBEL:
      // Jika web/apk sedang terbuka, set silent: true pada notifikasi native OS
      // agar speaker HP tidak membunyikan nada default OS bersamaan dengan Web Audio custom.
      // Jika web/apk sedang ditutup, biarkan silent: false agar sistem HP tetap membunyikan nada & getar.
      options.silent = hasOpenClient;

      // 1. Tampilkan notifikasi native di layar HP / OS
      await self.registration.showNotification(payload.title, options);

      // 2. Jika ada web/apk terbuka, kirim sinyal untuk memutar audio custom
      if (hasOpenClient) {
        for (const client of clientList) {
          client.postMessage({
            type: "PLAY_PUSH_NOTIFICATION_SOUND",
            soundUrl: soundUrl,
            title: payload.title,
            body: payload.body,
          });
        }
      }
    })()
  );
});

/* ──── Notification Click Handler ─────────────────────────────────────────── */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;

  const targetUrl = (event.notification.data && event.notification.data.url) || "/dashboard/transactions";
  const origin = self.location.origin;
  const fullUrl = targetUrl.startsWith("http") ? targetUrl : origin + targetUrl;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Jika sudah ada tab terbuka → fokus dan navigate
      for (const client of clientList) {
        if (client.url.startsWith(origin) && "focus" in client) {
          client.focus();
          client.navigate(fullUrl);
          return;
        }
      }
      // Buka tab baru jika belum terbuka
      if (self.clients.openWindow) return self.clients.openWindow(fullUrl);
    })
  );
});

/* ──── Push Subscription Change ────────────────────────────────────────────── */
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    self.registration.pushManager.subscribe({ userVisibleOnly: true })
      .then((subscription) =>
        fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(subscription.toJSON()),
        })
      )
  );
});
