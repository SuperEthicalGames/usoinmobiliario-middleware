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

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* payload no era JSON válido, sigue con {} */ }
  const title = data.title || 'Uso Inmobiliario';
  const options = {
    body: data.body || '',
    tag: data.targetCode || undefined, // mismo código -> reemplaza el aviso anterior en vez de apilar duplicados
    data: { targetCode: data.targetCode || null },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Al hacer clic: si ya hay una pestaña del panel abierta, la enfoca en vez de abrir una nueva.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const scopeUrl = self.registration.scope; // ya incluye el subpath correcto (GitHub Pages)
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(scopeUrl) && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(scopeUrl);
    })
  );
});
