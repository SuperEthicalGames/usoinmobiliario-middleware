import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { Notification } from '../types';
import { BellIcon } from './icons';
import { isPushSupported, isSubscribed, subscribeToPush } from '../lib/push';

// Sondeo simple (sin WebSocket/SSE — no vale la pena la complejidad para el volumen real de un
// solo negocio pequeño) cada 60s, generoso igual que el resto de límites del proyecto para un
// panel con un puñado de cuentas activas a la vez. Las notificaciones EN TIEMPO REAL de verdad
// (con el navegador cerrado) salen por push (ver lib/push.ts) — esto es solo lo que se ve
// dentro del panel cuando está abierto.
const POLL_MS = 60000;

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `hace ${hr} h`;
  return `hace ${Math.floor(hr / 24)} d`;
}

// Fila de activación — pedido explícito: "pedirle al usuario que encienda las notificaciones
// de su navegador". Vive DENTRO del panel de notificaciones en vez de un popup aparte, porque
// es exactamente donde alguien ya está mirando cuando le importa este tema. Se oculta sola en
// cuanto ya está suscrito o el navegador no soporta push (Safari de escritorio, o iOS sin
// "Agregado a inicio") — nunca ofrece un botón que va a fallar.
function PushOptIn() {
  const [status, setStatus] = useState<'checking' | 'hidden' | 'offer' | 'denied' | 'subscribing' | 'subscribed' | 'error'>('checking');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isPushSupported()) { setStatus('hidden'); return; }
    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') { setStatus('denied'); return; }
    isSubscribed().then((sub) => setStatus(sub ? 'subscribed' : 'offer'));
  }, []);

  async function activate() {
    setStatus('subscribing');
    setError(null);
    const failure = await subscribeToPush();
    if (failure) { setError(failure); setStatus('error'); return; }
    setStatus('subscribed');
  }

  if (status === 'checking' || status === 'hidden' || status === 'subscribed') return null;

  return (
    <div className="border-b border-line bg-gold/10 px-4 py-3">
      {status === 'denied' ? (
        <p className="text-xs text-muted">
          Las notificaciones están bloqueadas para este sitio en tu navegador — actívalas desde la configuración del navegador (el candado junto a la dirección) si quieres recibirlas aunque el panel esté cerrado.
        </p>
      ) : (
        <>
          <p className="text-xs text-ink/80">Recibe estas notificaciones en tu dispositivo aunque el panel esté cerrado.</p>
          <button
            onClick={activate}
            disabled={status === 'subscribing'}
            className="mt-2 rounded-full bg-gold px-3.5 py-1.5 text-xs font-bold text-ink transition hover:bg-gold-light disabled:opacity-60"
          >
            {status === 'subscribing' ? 'Activando...' : 'Activar notificaciones'}
          </button>
          {status === 'error' && error && <p className="mt-1.5 text-xs text-red-dark">{error}</p>}
        </>
      )}
    </div>
  );
}

export function NotificationBell() {
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  function load() {
    api.getNotifications(30).then(setItems).catch(() => {
      // Silencioso a propósito — un fallo acá no debe interrumpir el resto del panel, la
      // campana simplemente se queda con el último estado conocido hasta el próximo sondeo.
    });
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, POLL_MS);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  async function markRead(n: Notification) {
    if (n.read) return;
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    try { await api.markNotificationRead(n.id); } catch { /* estado local ya optimista, un reintento del próximo sondeo lo corrige si hace falta */ }
  }

  const unreadCount = items.filter((n) => !n.read).length;

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notificaciones"
        className="relative rounded-lg p-2 text-ink/70 transition hover:bg-paper-2 hover:text-ink"
      >
        <BellIcon className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[26rem] max-w-[92vw] rounded-xl border border-line bg-card shadow-xl">
          <div className="border-b border-line px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted">
            Notificaciones
          </div>
          <PushOptIn />
          <div className="max-h-[28rem] overflow-y-auto">
            {items.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted">Sin notificaciones.</p>}
            {items.map((n) => (
              <button
                key={n.id}
                onClick={() => markRead(n)}
                className={`flex w-full flex-col gap-1 border-b border-line px-4 py-3.5 text-left text-sm transition last:border-0 hover:bg-paper-2 ${
                  n.read ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start gap-2">
                  {!n.read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />}
                  <span className={n.read ? '' : 'font-semibold text-ink'}>{n.message}</span>
                </div>
                <span className="pl-3.5 text-xs text-muted">{timeAgo(n.createdAt)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
