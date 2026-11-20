/* Black Bird Training offline support: the app shell is cached so workouts run without a signal. */
const CACHE = "bbt-v71";
const SHELL = ["/app", "/icon-192.png", "/icon-512.png", "/maskable-512.png", "/apple-touch-icon.png", "/favicon.ico", "/manifest.json", "/qrcode.min.js"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const r = e.request, u = new URL(r.url);
  if(r.method !== "GET") return;
  /* the app page: network first, cached copy when offline */
  if(r.mode === "navigate" && u.origin === location.origin && (u.pathname === "/app" || u.pathname === "/app.html" || u.pathname === "/app/")){
    e.respondWith(fetch(r.url, {cache:"no-store", credentials:"same-origin"}).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put("/app", cp)); return res; })
      .catch(() => caches.match("/app")));
    return;
  }
  /* fonts and the supabase library: cache first, refresh in the background */
  const lib = u.host === "fonts.googleapis.com" || u.host === "fonts.gstatic.com" || (u.host === "cdn.jsdelivr.net" && u.pathname.includes("supabase"));
  const own = u.origin === location.origin && SHELL.includes(u.pathname);
  if(lib || own){
    e.respondWith(caches.match(r).then(hit => {
      const net = fetch(r).then(res => { if(res && (res.ok || res.type === "opaque")){ const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); } return res; }).catch(() => hit);
      return hit || net;
    }));
  }
  /* everything else (Supabase API, Paddle, images) goes straight to the network */
});

/* phone notifications */
self.addEventListener("push", e => {
  let d = {}; try{ d = e.data ? e.data.json() : {}; }catch(x){ d = {body: e.data ? e.data.text() : ""}; }
  e.waitUntil(self.registration.showNotification(d.title || "The Black Bird Society", {body: d.body || "", icon: "/icon-192.png", badge: "/favicon-96.png", tag: d.tag || undefined, renotify: !!d.tag, data: {url: d.url || "/app?n=1"}}));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/app?n=1";
  e.waitUntil(self.clients.matchAll({type: "window", includeUncontrolled: true}).then(cs => {
    for(const c of cs){ if(new URL(c.url).pathname.startsWith("/app")){ c.focus(); try{ c.navigate(url); }catch(x){} return; } }
    return self.clients.openWindow(url);
  }));
});
