// Service worker de Climaxpress: solo notificaciones push.
// No cachea nada (sin handler `fetch`): la app necesita datos frescos del día,
// no una versión vieja guardada.
// Se sirve desde la raíz para que el scope cubra toda la app, y está exento del
// proxy de auth (src/proxy.ts) porque el navegador lo pide sin cookies.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let aviso = {};
  try {
    aviso = event.data ? event.data.json() : {};
  } catch {
    aviso = {};
  }

  const tag = aviso.tag;
  event.waitUntil(
    self.registration.showNotification(aviso.titulo || "Climaxpress", {
      body: aviso.cuerpo || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      lang: "es-MX",
      // El tag agrupa los avisos de una misma renta en vez de apilarlos.
      tag,
      // renotify sin tag lanza TypeError y la notificación no sale.
      renotify: Boolean(tag),
      data: { url: aviso.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";

  // Si la app ya está abierta se reutiliza esa ventana; si no, se abre una.
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((ventanas) => {
        for (const ventana of ventanas) {
          if ("focus" in ventana) {
            if ("navigate" in ventana) ventana.navigate(url);
            return ventana.focus();
          }
        }
        return self.clients.openWindow(url);
      })
  );
});
