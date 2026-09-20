import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { Notification } from '../types';
import { BellIcon, ChevronRightIcon } from './icons';
import { isPushSupported, isSubscribed, subscribeToPush } from '../lib/push';
import { describeNotification, groupByDay, notificationPath, styleFor, timeAgo, type NotificationChip } from '../lib/notifications';

// Sondeo simple (sin WebSocket/SSE — no vale la pena la complejidad para el volumen real de un
// solo negocio pequeño) cada 60s, generoso igual que el resto de límites del proyecto para un
// panel con un puñado de cuentas activas a la vez. Las notificaciones EN TIEMPO REAL de verdad
// (con el navegador cerrado) salen por push (ver lib/push.ts) — esto es solo lo que se ve
// dentro del panel cuando está abierto.
const POLL_MS = 60000;

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

const CHIP_TONE: Record<NonNullable<NotificationChip['tone']>, string> = {
  strong: 'bg-emerald/10 font-bold text-emerald-dark',
  red: 'bg-red/10 font-bold text-red-dark',
  amber: 'bg-amber/10 font-bold text-amber-dark',
};

function NotificationCard({ n, onOpen }: { n: Notification; onOpen: (n: Notification) => void }) {
  const style = styleFor(n.type);
  const Icon = style.icon;
  const view = describeNotification(n);
  const actionable = notificationPath(n) !== null;
  const unread = !n.read;

  return (
    <button
      onClick={() => onOpen(n)}
      className={`group relative flex w-full gap-3 border-b border-line px-4 py-3.5 text-left transition last:border-0 hover:bg-paper-2 ${unread ? 'bg-gold/[0.05]' : ''}`}
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${unread ? style.bar : 'bg-transparent'}`} />
      <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${style.tile} ${unread ? '' : 'opacity-60'}`}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${style.chip} ${unread ? '' : 'opacity-70'}`}>{style.label}</span>
          <span className="shrink-0 text-[11px] text-muted" title={new Date(n.createdAt).toLocaleString('es-CO')}>{timeAgo(n.createdAt)}</span>
        </span>
        <span className={`mt-1 block text-sm leading-snug ${unread ? 'font-bold text-ink' : 'font-semibold text-ink/65'}`}>{view.title}</span>
        {view.subtitle && <span className="mt-0.5 block truncate text-xs text-ink/70">{view.subtitle}</span>}
        {view.chips.length > 0 && (
          <span className="mt-2 flex flex-wrap gap-1.5">
            {view.chips.map((c) => (
              <span key={c.text} className={`rounded-md px-2 py-0.5 text-[11px] ${c.tone ? CHIP_TONE[c.tone] : 'bg-paper-2 text-ink/75'}`}>{c.text}</span>
            ))}
          </span>
        )}
        {actionable && style.action && (
          <span className="mt-2 inline-flex items-center gap-0.5 text-xs font-bold text-gold-dark group-hover:underline">
            {style.action}
            <ChevronRightIcon className="h-3.5 w-3.5" />
          </span>
        )}
      </span>
      {unread && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-gold" aria-label="Sin leer" />}
    </button>
  );
}

export function NotificationBell() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [markingAll, setMarkingAll] = useState(false);
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

  // Clic en una notificación push del sistema operativo con el panel ya abierto: el service worker
  // (public/sw.js) enfoca la pestaña y manda la ruta destino en vez de recargarla.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    function onMessage(e: MessageEvent) {
      if (e.data && e.data.type === 'open-path' && typeof e.data.path === 'string') {
        navigate(e.data.path);
        load();
      }
    }
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [navigate]);

  async function markRead(n: Notification) {
    if (n.read) return;
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    try { await api.markNotificationRead(n.id); } catch { /* estado local ya optimista, un reintento del próximo sondeo lo corrige si hace falta */ }
  }

  // Clic = marcar como leída + ir a la pantalla donde se opera ese registro.
  function openNotification(n: Notification) {
    markRead(n);
    setOpen(false);
    const path = notificationPath(n);
    if (path) navigate(path);
  }

  async function markAllRead() {
    if (markingAll) return;
    setMarkingAll(true);
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    try { await api.markAllNotificationsRead(); } catch { load(); } finally { setMarkingAll(false); }
  }

  const unreadCount = items.filter((n) => !n.read).length;
  const visible = useMemo(() => (filter === 'unread' ? items.filter((n) => !n.read) : items), [items, filter]);
  const groups = useMemo(() => groupByDay(visible), [visible]);

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={unreadCount > 0 ? `Notificaciones, ${unreadCount} sin leer` : 'Notificaciones'}
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
        <div className="absolute right-0 top-full z-50 mt-2 w-[28rem] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-line bg-card shadow-2xl">
          <div className="flex items-center justify-between gap-3 bg-graphite-900 px-4 py-3.5 text-white">
            <div>
              <div className="font-display text-sm font-bold">Notificaciones</div>
              <div className="text-[11px] text-graphite-400">
                {unreadCount > 0 ? `${unreadCount} sin leer` : 'Todo al día'}
              </div>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                disabled={markingAll}
                className="rounded-full border border-white/20 px-3 py-1 text-[11px] font-bold text-white transition hover:bg-white/10 disabled:opacity-60"
              >
                Marcar todas como leídas
              </button>
            )}
          </div>

          <div className="flex gap-2 border-b border-line px-4 py-2.5">
            {([['all', 'Todas'], ['unread', 'Sin leer']] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide transition ${
                  filter === key ? 'bg-graphite-900 text-white' : 'border border-line text-muted hover:border-gold/60 hover:text-gold-dark'
                }`}
              >
                {label}{key === 'unread' && unreadCount > 0 ? ` (${unreadCount})` : ''}
              </button>
            ))}
          </div>

          <PushOptIn />

          <div className="max-h-[30rem] overflow-y-auto">
            {visible.length === 0 && (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-paper-2 text-muted"><BellIcon className="h-6 w-6" /></span>
                <p className="text-sm font-semibold text-ink/70">{filter === 'unread' ? 'No tienes notificaciones sin leer' : 'Sin notificaciones todavía'}</p>
                <p className="max-w-[16rem] text-xs text-muted">Aquí aparecerán las nuevas reservas, pagos por verificar, visitas y tareas asignadas.</p>
              </div>
            )}
            {groups.map((g) => (
              <div key={g.label}>
                <div className="sticky top-0 z-10 border-b border-line bg-paper-2/95 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted backdrop-blur">{g.label}</div>
                {g.items.map((n) => <NotificationCard key={n.id} n={n} onOpen={openNotification} />)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
