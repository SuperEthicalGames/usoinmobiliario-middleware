// Service Worker del panel — SOLO para notificaciones push (nada de cache/offline: ese no es
// el problema que esto resuelve, y un SW cacheando de más es una fuente clásica de "por qué
// sigo viendo la versión vieja" difícil de depurar; mejor no meterse en eso sin necesitarlo).
// Archivo de mano, sin vite-plugin-pwa — mismo criterio de "sin dependencias de más" ya usado
// con Cloudinary/Resend en este proyecto.

self.addEventListener('install', () => {
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Pantalla donde se opera cada tipo de evento — mismo mapa que SCREEN_BY_TYPE en
// src/lib/notifications.ts (este archivo no puede importar TypeScript, hay que mantenerlos iguales).
const SCREEN_BY_TYPE = {
  reservation: '/reservas',
  payment: '/pagos',
  visit: '/visitas',
  cleaning: '/aseo',
  maintenance: '/mantenimiento',
};

function pathFor(data) {
  const base = SCREEN_BY_TYPE[data && data.type];
  if (!base) return null;
  return data.targetCode ? base + '?code=' + encodeURIComponent(data.targetCode) : base;
}

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* payload no era JSON válido, sigue con {} */ }
  const title = data.title || 'Uso Inmobiliario';
  const options = {
    body: data.body || '',
    icon: new URL('brand/apple-touch-icon.png', self.registration.scope).href,
    tag: data.targetCode || undefined, // mismo código -> reemplaza el aviso anterior en vez de apilar duplicados
    data: { targetCode: data.targetCode || null, type: data.type || null },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Al hacer clic: lleva directo al registro del aviso. Si ya hay una pestaña del panel abierta, la
// enfoca y le manda la ruta (NotificationBell la recibe y navega, sin recargar); si no, abre el panel
// ya en esa pantalla. Sin tipo conocido, solo enfoca/abre el panel como antes.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const scopeUrl = self.registration.scope; // ya incluye el subpath correcto (GitHub Pages)
  const path = pathFor(event.notification.data);
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(scopeUrl) && 'focus' in client) {
          if (path) client.postMessage({ type: 'open-path', path });
          return client.focus();
        }
      }
      // App enrutada con HashRouter: la ruta va después de '#'.
      return self.clients.openWindow(path ? scopeUrl + '#' + path : scopeUrl);
    })
  );
});
