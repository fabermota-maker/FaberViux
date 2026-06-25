const CACHE_NAME = "faberviux-fullscreen-20260625";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-32.png",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png",
  "./avatar.png",
  "./favicon.ico",
  "./icons/icon-32.png",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/avatar.png"
];

function buildPwaHead(html) {
  const viewportTag = '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">';
  const requiredTags = [
    '<meta name="theme-color" content="#050506">',
    '<meta name="mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
    '<meta name="apple-mobile-web-app-title" content="FaberViux">',
    '<link rel="manifest" href="./manifest.webmanifest?v=fullscreen20260625">',
    '<link rel="apple-touch-icon" href="./icon-180.png">',
    '<link rel="icon" type="image/png" sizes="32x32" href="./icon-32.png">'
  ];

  let updated = html;

  if (/<meta\s+name=["']viewport["'][^>]*>/i.test(updated)) {
    updated = updated.replace(/<meta\s+name=["']viewport["'][^>]*>/i, viewportTag);
  } else {
    requiredTags.unshift(viewportTag);
  }

  const missingTags = requiredTags.filter(tag => {
    if (tag.includes('theme-color')) return !/name=["']theme-color["']/i.test(updated);
    if (tag.includes('mobile-web-app-capable')) return !/name=["']mobile-web-app-capable["']/i.test(updated);
    if (tag.includes('apple-mobile-web-app-capable')) return !/name=["']apple-mobile-web-app-capable["']/i.test(updated);
    if (tag.includes('apple-mobile-web-app-status-bar-style')) return !/name=["']apple-mobile-web-app-status-bar-style["']/i.test(updated);
    if (tag.includes('apple-mobile-web-app-title')) return !/name=["']apple-mobile-web-app-title["']/i.test(updated);
    if (tag.includes('rel="manifest"')) return !/rel=["']manifest["']/i.test(updated);
    if (tag.includes('apple-touch-icon')) return !/rel=["']apple-touch-icon["']/i.test(updated);
    if (tag.includes('sizes="32x32"')) return !/sizes=["']32x32["']/i.test(updated);
    return true;
  });

  if (!missingTags.length) return updated;

  const injection = "\n  <!-- PWA fullscreen mobile -->\n  " + missingTags.join("\n  ") + "\n";
  if (/<\/head>/i.test(updated)) {
    return updated.replace(/<\/head>/i, injection + "</head>");
  }
  return injection + updated;
}

async function cacheCoreAssets() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.allSettled(
    CORE_ASSETS.map(asset => cache.add(new Request(asset, { cache: "reload" })))
  );
}

self.addEventListener("install", event => {
  event.waitUntil(cacheCoreAssets().then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const request = event.request;
  const accept = request.headers.get("accept") || "";
  const isNavigation = request.mode === "navigate" || accept.includes("text/html");

  if (isNavigation) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: "no-store" });
        const contentType = response.headers.get("content-type") || "";

        if (response.ok && contentType.includes("text/html")) {
          const sourceHtml = await response.clone().text();
          const updatedHtml = buildPwaHead(sourceHtml);
          const updatedResponse = new Response(updatedHtml, {
            status: response.status,
            statusText: response.statusText,
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "no-store"
            }
          });

          const cache = await caches.open(CACHE_NAME);
          await cache.put("./index.html", updatedResponse.clone());
          return updatedResponse;
        }

        return response;
      } catch (error) {
        const cached = await caches.match("./index.html") || await caches.match(request);
        return cached || new Response("FaberViux offline", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    const contentType = response.headers.get("content-type") || "";
    if (response.ok && !contentType.includes("text/html")) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  })());
});
