import { VAPID_PUBLIC_KEY } from '../config';
import { api } from '../api';

// Notificaciones push del sistema operativo (Web Push: Push API + Service Worker + VAPID) —
// funciona en Chrome/Edge/Firefox de escritorio y Android sin nada extra; en iOS Safari SOLO
// si el sitio ya está "Agregado a inicio" como PWA (iOS 16.4+, limitación real de Apple, no
// evitable con código) — isPushSupported() da false ahí, así que la UI simplemente no ofrece
// el botón en vez de prometer algo que va a fallar.
export function isPushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

export function getPermission(): NotificationPermission | 'unsupported' {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

// Convierte la llave VAPID (base64url, como la entrega `web-push generate-vapid-keys`) al
// Uint8Array que pide pushManager.subscribe — la Push API no acepta el string tal cual.
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);
  if (existing) return existing;
  // BASE_URL (no una ruta fija) porque el panel vive en un subpath de GitHub Pages
  // (/usoinmobiliario-middleware/) — un SW registrado en la raíz nunca controlaría esta app.
  return navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
}

// Pide permiso, registra el service worker, se suscribe y manda la suscripción al backend —
// en ese orden, porque cada paso puede fallar/cancelarse antes del siguiente (el usuario puede
// negar el permiso, por ejemplo). Devuelve la razón si algo no se pudo activar, o null si salió
// bien, para que la UI muestre un mensaje útil en vez de fallar en silencio.
export async function subscribeToPush(): Promise<string | null> {
  if (!isPushSupported()) return 'Este navegador no soporta notificaciones push.';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'No se activaron — el navegador no dio permiso.';
  try {
    const registration = await getRegistration();
    await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        // TS 5.7's stricter typed-array generics flag Uint8Array as ArrayBufferLike vs the DOM
        // lib's ArrayBuffer-only BufferSource here — real value is a valid BufferSource at
        // runtime regardless, this is a typing mismatch, not a real type error.
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
    }
    await api.pushSubscribe(subscription.toJSON() as PushSubscriptionJSON);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : 'No se pudo activar las notificaciones.';
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await api.pushUnsubscribe(endpoint).catch(() => {});
}

export async function isSubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false;
  const registration = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);
  const subscription = await registration?.pushManager.getSubscription();
  return !!subscription;
}
