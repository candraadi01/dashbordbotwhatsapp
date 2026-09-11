/* CANDRA BOT PWA service worker. Dashboard/API traffic stays network-first and uncached. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
