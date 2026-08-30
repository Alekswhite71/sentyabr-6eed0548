/* Service worker: офлайн-кэш + приём ежедневных пуш-уведомлений. */

const CACHE = "nash-sentyabr-v6";

// то, без чего страница не откроется в самолётном режиме
const CORE = [
  "./",
  "./index.html",
  "./phrases.json",
  "./photos/cover.jpg",
  "./photos/01-tulips.jpg",
  "./photos/02-kiss-forehead.jpg",
  "./photos/03-lake.jpg",
  "./photos/04-cat.jpg",
  "./photos/05-kiss.jpg",
  "./photos/06-mirror.jpg",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(CORE))
      .catch(() => null)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Стратегия: сеть вперёд, кэш как подстраховка.
   Свои фотографии кэшируем после первой загрузки, чтобы открытка
   работала без интернета. */
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const isPhoto = url.hostname === "upload.wikimedia.org";
  const isOwn = url.origin === self.location.origin;
  if (!isPhoto && !isOwn) return;

  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && (res.ok || res.type === "opaque")) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html")))
  );
});

/* Ежедневный пуш от GitHub Actions */
self.addEventListener("push", (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch (_) {
    d = { title: "♥", body: e.data ? e.data.text() : "" };
  }

  const title = d.title || "♥ Сообщение для тебя";
  const opts = {
    body: d.body || "",
    icon: "./icons/icon-192.png",
    badge: "./icons/icon-192.png",
    tag: d.tag || "daily",
    renotify: true,
    data: { url: d.url || "./" }
  };

  e.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) return c.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});
