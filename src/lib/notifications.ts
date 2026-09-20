import type { ComponentType } from 'react';
import type { Notification } from '../types';
import { BellIcon, CalendarIcon, CardIcon, PinIcon, SparkleIcon, WrenchIcon, type IconProps } from '../components/icons';
import { fmtCOP } from '../components/ui';

type NotificationType = Notification['type'];

// Un color + un icono por tipo, para distinguir de un vistazo una reserva de un pago, una visita o
// una tarea operativa sin leer el texto. Las clases van completas (no armadas por concatenación)
// para que Tailwind las detecte al compilar.
interface TypeStyle {
  label: string;
  icon: ComponentType<IconProps>;
  tile: string;
  chip: string;
  bar: string;
  action: string;
}

export const NOTIFICATION_STYLES: Record<NotificationType, TypeStyle> = {
  reservation: { label: 'Reserva', icon: CalendarIcon, tile: 'bg-gold/15 text-gold-dark', chip: 'bg-gold/15 text-gold-dark', bar: 'bg-gold', action: 'Abrir reserva' },
  payment: { label: 'Pago', icon: CardIcon, tile: 'bg-emerald/15 text-emerald-dark', chip: 'bg-emerald/15 text-emerald-dark', bar: 'bg-emerald', action: 'Revisar pago' },
  visit: { label: 'Visita', icon: PinIcon, tile: 'bg-graphite-600/10 text-graphite-600', chip: 'bg-graphite-600/10 text-graphite-600', bar: 'bg-graphite-600', action: 'Abrir visita' },
  cleaning: { label: 'Aseo', icon: SparkleIcon, tile: 'bg-amber/15 text-amber-dark', chip: 'bg-amber/15 text-amber-dark', bar: 'bg-amber', action: 'Ver tarea' },
  maintenance: { label: 'Mantenimiento', icon: WrenchIcon, tile: 'bg-red/10 text-red-dark', chip: 'bg-red/10 text-red-dark', bar: 'bg-red', action: 'Ver ticket' },
  system: { label: 'Sistema', icon: BellIcon, tile: 'bg-graphite-600/10 text-graphite-600', chip: 'bg-graphite-600/10 text-graphite-600', bar: 'bg-graphite-600', action: '' },
};

export function styleFor(type: string): TypeStyle {
  return NOTIFICATION_STYLES[type as NotificationType] ?? NOTIFICATION_STYLES.system;
}

const SCREEN_BY_TYPE: Partial<Record<NotificationType, string>> = {
  reservation: '/reservas',
  payment: '/pagos',
  visit: '/visitas',
  cleaning: '/aseo',
  maintenance: '/mantenimiento',
};

// Pantalla donde se opera el evento, con ?code= para que esa pantalla abra/resalte exactamente el
// registro (ver lib/focusCode.ts). Debe mantenerse igual al mapa de public/sw.js (el clic sobre el
// push del sistema operativo usa el mismo destino).
export function notificationPath(n: Pick<Notification, 'type' | 'targetCode'>): string | null {
  const base = SCREEN_BY_TYPE[n.type];
  if (!base) return null;
  return n.targetCode ? `${base}?code=${encodeURIComponent(n.targetCode)}` : base;
}

export interface NotificationChip {
  text: string;
  tone?: 'strong' | 'red' | 'amber';
}

export interface NotificationView {
  title: string;
  subtitle: string | null;
  chips: NotificationChip[];
}

// Fechas compactas para las tarjetas ("10 nov → 13 nov"): el año solo aparece si no es el actual.
// Meses fijos en vez de toLocaleDateString para que el resultado no cambie según el navegador.
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
function shortParts(iso: string): { text: string; year: number } | null {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return { text: `${d} ${MONTHS[m - 1]}`, year: y };
}
function fmtShortDate(iso: string): string {
  const p = shortParts(iso);
  if (!p) return iso;
  return p.year === new Date().getFullYear() ? p.text : `${p.text} ${p.year}`;
}
function fmtShortRange(a: string, b: string): string {
  const pa = shortParts(a);
  const pb = shortParts(b);
  if (!pa || !pb) return `${a} → ${b}`;
  const year = pb.year === new Date().getFullYear() && pa.year === pb.year ? '' : ` ${pb.year}`;
  return `${pa.text}${pa.year !== pb.year ? ` ${pa.year}` : ''} → ${pb.text}${year}`;
}

const PRIORITY_TONE = { alta: 'red', media: 'amber', baja: undefined } as const;

// Arma lo que se muestra en la tarjeta. Sin `meta` (notificaciones anteriores a este modelo) cae al
// texto plano de `message`, exactamente como se veía antes.
export function describeNotification(n: Notification): NotificationView {
  const m = n.meta;
  if (!m) return { title: n.message, subtitle: null, chips: [] };

  const who = [m.unit, m.person].filter(Boolean).join(' · ') || null;
  const code = n.targetCode ? ` · ${n.targetCode}` : '';
  const chips: NotificationChip[] = [];

  switch (n.type) {
    case 'reservation':
      if (m.checkin && m.checkout) chips.push({ text: fmtShortRange(m.checkin, m.checkout) });
      if (m.nights) chips.push({ text: `${m.nights} ${m.nights === 1 ? 'noche' : 'noches'}` });
      if (m.guests) chips.push({ text: `${m.guests} ${m.guests === 1 ? 'huésped' : 'huéspedes'}` });
      if (m.amount != null) chips.push({ text: fmtCOP(m.amount), tone: 'strong' });
      return { title: `${n.message.startsWith('Nueva reserva manual') ? 'Reserva manual' : 'Nueva reserva'}${code}`, subtitle: who, chips };
    case 'payment':
      if (m.amount != null) chips.push({ text: fmtCOP(m.amount), tone: 'strong' });
      if (m.bank) chips.push({ text: m.bank });
      if (m.reference) chips.push({ text: `ref. ${m.reference}` });
      return { title: `Pago por verificar${code}`, subtitle: who, chips };
    case 'visit':
      if (m.date) chips.push({ text: fmtShortDate(m.date) });
      if (m.time) chips.push({ text: m.time });
      return { title: `Nueva visita${code}`, subtitle: who, chips };
    case 'cleaning':
      if (m.date) chips.push({ text: fmtShortDate(m.date) });
      if (m.detail) chips.push({ text: m.detail });
      return { title: `Aseo asignado${code}`, subtitle: who, chips };
    case 'maintenance':
      if (m.priority) chips.push({ text: `Prioridad ${m.priority}`, tone: PRIORITY_TONE[m.priority] });
      return { title: m.title || `Mantenimiento asignado${code}`, subtitle: who, chips };
    default:
      return { title: n.message, subtitle: null, chips: [] };
  }
}

export function timeAgo(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `hace ${hr} h`;
  return `hace ${Math.floor(hr / 24)} d`;
}

// Agrupa (ya ordenadas de más reciente a más antigua) en Hoy / Ayer / Anteriores, por día LOCAL.
export function groupByDay<T extends { createdAt: string }>(items: T[]): { label: string; items: T[] }[] {
  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const now = new Date();
  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const groups: { label: string; items: T[] }[] = [];
  for (const it of items) {
    const k = dayKey(new Date(it.createdAt));
    const label = k === today ? 'Hoy' : k === yesterday ? 'Ayer' : 'Anteriores';
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(it);
    else groups.push({ label, items: [it] });
  }
  return groups;
}
