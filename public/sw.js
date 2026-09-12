/* CANDRA BOT PWA Service Worker — v2 (Push Notifications) */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

/* ──────────── Push Event ──────────── */
self.addEventListener("push", (event) => {
  let data = { title: "CANDRA BOT", body: "Ada aktivitas baru." };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    if (event.data) data.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag || "candra-push",
      data: data,
      vibrate: [200, 100, 200],
    })
  );
});

/* ──────────── Notification Click ──────────── */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const transactionId = event.notification.data?.transactionId;
  const targetUrl = transactionId
    ? `/dashboard/transactions?edit=${encodeURIComponent(transactionId)}`
    : "/dashboard";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Coba fokus ke tab yang sudah terbuka
        for (const client of clientList) {
          if (client.url.includes("/dashboard") && "focus" in client) {
            void client.focus();
            if ("navigate" in client) {
              return client.navigate(targetUrl);
            }
            return;
          }
        }
        // Buka tab baru jika belum ada
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

