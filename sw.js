/* Black Bird Training offline support: the app shell is cached so workouts run without a signal. */
const CACHE = "bbt-v30";
const SHELL = ["/app", "/icon-192.png", "/icon-512.png", "/maskable-512.png", "/apple-touch-icon.png", "/favicon.ico", "/manifest.json"];
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
    e.respondWith(fetch(r).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put("/app", cp)); return res; })
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
