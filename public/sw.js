/* CANDRA BOT PWA Service Worker — v3 (Web Push & Background Notifications) */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

/* ──────────── Push Event (Diterima dari Web Push Server saat browser tutup) ──────────── */
self.addEventListener("push", (event) => {
  let data = {
    title: "CANDRA BOT",
    body: "Ada aktivitas pesanan baru masuk.",
    url: "/dashboard/transactions",
  };

  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const title = data.title || "Transaksi Baru Masuk!";
  const options = {
    body: data.body,
    icon: data.icon || "/icons/icon-192.png",
    badge: data.badge || "/icons/icon-192.png",
    tag: data.tag || `candra-${Date.now()}`,
    data: data,
    vibrate: [250, 100, 250, 100, 250],
    renotify: true,
    requireInteraction: true,
    actions: [
      { action: "open", title: "Lihat Detail" }
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/* ──────────── Notification Click (Saat notifikasi di layar HP diklik) ──────────── */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const transactionId = data.transactionId || data.trxId;
  const targetUrl = data.url || (transactionId
    ? `/dashboard/transactions?edit=${encodeURIComponent(transactionId)}`
    : "/dashboard/transactions");

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Coba fokus ke tab dashboard yang sudah aktif
        for (const client of clientList) {
          if (client.url.includes("/dashboard") && "focus" in client) {
            void client.focus();
            if ("navigate" in client) {
              return client.navigate(targetUrl);
            }
            return;
          }
        }
        // Buka jendela / tab baru jika browser tertutup
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
