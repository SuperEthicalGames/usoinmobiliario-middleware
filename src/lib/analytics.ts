import type { Apartment, ReservationRecord } from '../types';

// Agregaciones puras (sin fetch, sin estado) sobre los datos que YA expone el backend
// (/reservations, /visits, /apartments) — nada acá pide un endpoint nuevo. Mismo criterio de
// fecha que dateUtil.js del backend (Bogotá, UTC-5 fijo, fechas puras "YYYY-MM-DD"): un panel
// de analítica que contara "hoy" distinto del resto del panel sería peor que no tenerlo.

export function todayIsoBogota(): string {
  const nowBogota = new Date(Date.now() - 5 * 60 * 60 * 1000);
  return nowBogota.toISOString().slice(0, 10);
}

function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

// Puerto directo de nightsBetween() en dateUtil.js — una noche por cada día desde checkin
// (incl.) hasta checkout (excl.), mismo criterio que el backend usa para bookedNights.
export function nightsBetween(checkinIso: string, checkoutIso: string): string[] {
  const nights: string[] = [];
  let d = parseIsoDate(checkinIso);
  const end = parseIsoDate(checkoutIso);
  while (d < end) {
    nights.push(d.toISOString().slice(0, 10));
    d = new Date(d.getTime() + 24 * 60 * 60 * 1000);
  }
  return nights;
}

function daysInMonth(key: string): number {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function dayLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('es-CO', { month: 'short', year: '2-digit', timeZone: 'UTC' });
}

function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export type Period = '6m' | '12m' | 'all';
export const PERIOD_OPTIONS: { key: Period; label: string }[] = [
  { key: '6m', label: 'Últimos 6 meses' },
  { key: '12m', label: 'Últimos 12 meses' },
  { key: 'all', label: 'Todo' },
];

// Lista de "YYYY-MM" en orden cronológico para el período elegido — 6m/12m siempre terminan en
// el mes actual (aunque no tenga datos todavía), 'all' arranca en el mes más viejo que aparezca
// en los datos y no se corta antes del mes actual.
export function monthRange(period: Period, dataMonthKeys: string[]): string[] {
  const current = monthKey(todayIsoBogota());
  if (period !== 'all') {
    const n = period === '6m' ? 6 : 12;
    const out: string[] = [];
    let k = shiftMonth(current, -(n - 1));
    for (let i = 0; i < n; i++) { out.push(k); k = shiftMonth(k, 1); }
    return out;
  }
  if (dataMonthKeys.length === 0) return [current];
  const sorted = [...new Set(dataMonthKeys)].sort();
  const end = sorted[sorted.length - 1] > current ? sorted[sorted.length - 1] : current;
  const out: string[] = [];
  let k = sorted[0];
  while (k <= end) { out.push(k); k = shiftMonth(k, 1); }
  return out;
}

const ACTIVE_RESERVATION_STATUSES = new Set(['pendiente', 'confirmada', 'completada']);
const REALIZED_STAY_STATUSES = new Set(['confirmada', 'completada']);

export interface RevenuePoint { key: string; label: string; verified: number; pending: number; }

// Ingreso atribuido al mes de CHECK-IN (el mes en que de verdad se ocupa el apartamento), no al
// mes en que se creó la reserva — para "tendencia de ingresos" eso es lo que importa para el
// negocio. 'verified' = plata ya confirmada (transferencia verificada o efectivo registrado,
// ambos terminan en paymentStatus 'verified'); 'pending' = reportada pero sin verificar todavía.
export function revenueByMonth(reservations: ReservationRecord[], period: Period): RevenuePoint[] {
  const relevant = reservations.filter((r) => r.type === 'reserva' && r.checkin && ACTIVE_RESERVATION_STATUSES.has(r.status));
  const months = monthRange(period, relevant.map((r) => monthKey(r.checkin!)));
  const byMonth = new Map<string, { verified: number; pending: number }>();
  for (const key of months) byMonth.set(key, { verified: 0, pending: 0 });
  for (const r of relevant) {
    const key = monthKey(r.checkin!);
    const bucket = byMonth.get(key);
    if (!bucket) continue; // fuera del rango elegido
    const total = r.estTotal ?? 0;
    if (r.paymentStatus === 'verified') bucket.verified += total;
    else if (r.paymentStatus === 'submitted') bucket.pending += total;
  }
  return months.map((key) => ({ key, label: monthLabel(key), ...byMonth.get(key)! }));
}

export interface VolumePoint { key: string; label: string; count: number; }

// Volumen de reservas CREADAS por mes (demanda entrante) — createdAt, no checkin: mide cuánto
// está llegando, no cuánto se está ocupando (eso ya lo cubre occupancyByMonth).
export function reservationsCreatedByMonth(reservations: ReservationRecord[], period: Period): VolumePoint[] {
  const relevant = reservations.filter((r) => r.type === 'reserva' && r.createdAt);
  const months = monthRange(period, relevant.map((r) => monthKey(r.createdAt)));
  const byMonth = new Map<string, number>();
  for (const key of months) byMonth.set(key, 0);
  for (const r of relevant) {
    const key = monthKey(r.createdAt);
    if (byMonth.has(key)) byMonth.set(key, byMonth.get(key)! + 1);
  }
  return months.map((key) => ({ key, label: monthLabel(key), count: byMonth.get(key)! }));
}

export interface OccupancyPoint { key: string; label: string; rate: number; bookedNights: number; capacityNights: number; }

// % de noches-apartamento ocupadas por mes = noches reservadas (solo confirmada/completada,
// igual que effectiveStatus en el backend) / (apartamentos x días del mes). Una reserva que
// cruza fin de mes reparte sus noches en los dos meses que de verdad ocupa.
export function occupancyByMonth(reservations: ReservationRecord[], apartments: Apartment[], period: Period): OccupancyPoint[] {
  const stays = reservations.filter((r) => r.type === 'reserva' && r.checkin && r.checkout && REALIZED_STAY_STATUSES.has(r.status));
  const allNightMonths = stays.flatMap((r) => nightsBetween(r.checkin!, r.checkout!).map(monthKey));
  const months = monthRange(period, allNightMonths);
  const nightsByMonth = new Map<string, number>();
  for (const key of months) nightsByMonth.set(key, 0);
  for (const r of stays) {
    for (const night of nightsBetween(r.checkin!, r.checkout!)) {
      const key = monthKey(night);
      if (nightsByMonth.has(key)) nightsByMonth.set(key, nightsByMonth.get(key)! + 1);
    }
  }
  const unitCount = Math.max(apartments.length, 1);
  return months.map((key) => {
    const bookedNights = nightsByMonth.get(key)!;
    const capacityNights = unitCount * daysInMonth(key);
    return { key, label: monthLabel(key), bookedNights, capacityNights, rate: capacityNights > 0 ? bookedNights / capacityNights : 0 };
  });
}

export interface StatusSlice { status: string; label: string; count: number; tone: 'emerald' | 'amber' | 'red' | 'graphite'; }

const RESERVATION_STATUS_META: Record<string, { label: string; tone: StatusSlice['tone'] }> = {
  pendiente: { label: 'Pendiente', tone: 'amber' },
  confirmada: { label: 'Confirmada', tone: 'emerald' },
  rechazada: { label: 'Rechazada', tone: 'red' },
  cancelada: { label: 'Cancelada', tone: 'graphite' },
  completada: { label: 'Completada', tone: 'emerald' },
};
const STATUS_ORDER = ['pendiente', 'confirmada', 'completada', 'rechazada', 'cancelada'];

export function statusBreakdown(records: ReservationRecord[]): StatusSlice[] {
  const counts = new Map<string, number>();
  for (const r of records) counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
  return STATUS_ORDER.filter((s) => counts.has(s)).map((status) => ({
    status, count: counts.get(status)!, ...RESERVATION_STATUS_META[status],
  }));
}

export interface ApartmentPerf {
  key: string; label: string; category: string; nights: number; revenue: number; occupancyRate: number;
}

// Tabla, no gráfico — 17 apartamentos son demasiadas categorías para un chart legible
// (choosing-a-form: "más de ~7 clases -> tabla"), pero es exactamente el desglose que un
// operador necesita para ver qué unidad rinde y cuál está floja.
export function apartmentPerformance(
  reservations: ReservationRecord[], apartments: Apartment[], categories: Record<string, { catLabel?: { es: string } }>, period: Period,
): ApartmentPerf[] {
  const months = monthRange(period, []);
  const totalDays = months.reduce((sum, m) => sum + daysInMonth(m), 0);
  const monthSet = new Set(months);
  const stays = reservations.filter((r) => r.type === 'reserva' && r.checkin && r.checkout && REALIZED_STAY_STATUSES.has(r.status));

  const byUnit = new Map<string, { nights: number; revenue: number }>();
  for (const r of stays) {
    const unitKey = `${r.unitType}_${r.unitNum}`;
    const nightsInRange = nightsBetween(r.checkin!, r.checkout!).filter((n) => monthSet.has(monthKey(n)));
    if (nightsInRange.length === 0) continue;
    const entry = byUnit.get(unitKey) ?? { nights: 0, revenue: 0 };
    entry.nights += nightsInRange.length;
    // Prorratea el ingreso por noche dentro del rango — una estadía que cruza fuera del
    // período elegido no debe cargar su ingreso completo a un mes que no le corresponde.
    const totalNights = r.nights || nightsBetween(r.checkin!, r.checkout!).length || 1;
    entry.revenue += ((r.estTotal ?? 0) / totalNights) * nightsInRange.length;
    byUnit.set(unitKey, entry);
  }

  return apartments
    .map((apt) => {
      const unitKey = `${apt.typeKey}_${apt.num}`;
      const entry = byUnit.get(unitKey) ?? { nights: 0, revenue: 0 };
      return {
        key: unitKey,
        label: `Apartamento H${apt.num}`,
        category: categories[apt.typeKey]?.catLabel?.es ?? apt.typeKey,
        nights: entry.nights,
        revenue: Math.round(entry.revenue),
        occupancyRate: totalDays > 0 ? entry.nights / totalDays : 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

export interface TodayBoard { arrivals: ReservationRecord[]; departures: ReservationRecord[]; inHouse: ReservationRecord[]; }

// Tablero operativo del día — quién llega, quién sale, quién sigue adentro. Todo ya vive en
// checkin/checkout de cada reserva confirmada, ningún campo nuevo hace falta para esto.
export function todayBoard(reservations: ReservationRecord[]): TodayBoard {
  const today = todayIsoBogota();
  const stays = reservations.filter((r) => r.type === 'reserva' && r.status === 'confirmada' && r.checkin && r.checkout);
  return {
    arrivals: stays.filter((r) => r.checkin === today),
    departures: stays.filter((r) => r.checkout === today),
    inHouse: stays.filter((r) => r.checkin! <= today && today < r.checkout!),
  };
}

export interface KpiSummary {
  verifiedRevenue: number;
  pendingRevenue: number;
  occupancyRate: number;
  avgNights: number;
  reservationsInPeriod: number;
  visitsInPeriod: number;
  visitsCompletionRate: number;
}

export function kpiSummary(
  reservations: ReservationRecord[], visits: ReservationRecord[], apartments: Apartment[], period: Period,
): KpiSummary {
  const revenue = revenueByMonth(reservations, period);
  const occupancy = occupancyByMonth(reservations, apartments, period);
  const months = new Set(revenue.map((p) => p.key));

  const stays = reservations.filter((r) => r.type === 'reserva' && r.checkin && REALIZED_STAY_STATUSES.has(r.status) && months.has(monthKey(r.checkin!)));
  const avgNights = stays.length > 0 ? stays.reduce((s, r) => s + (r.nights ?? 0), 0) / stays.length : 0;

  const reservationsInPeriod = reservations.filter((r) => r.type === 'reserva' && r.createdAt && months.has(monthKey(r.createdAt))).length;
  const visitsInRange = visits.filter((v) => v.createdAt && months.has(monthKey(v.createdAt)));
  const completedVisits = visitsInRange.filter((v) => v.status === 'completada').length;
  const decidedVisits = visitsInRange.filter((v) => v.status === 'completada' || v.status === 'rechazada' || v.status === 'cancelada').length;

  const totalBooked = occupancy.reduce((s, p) => s + p.bookedNights, 0);
  const totalCapacity = occupancy.reduce((s, p) => s + p.capacityNights, 0);

  return {
    verifiedRevenue: revenue.reduce((s, p) => s + p.verified, 0),
    pendingRevenue: revenue.reduce((s, p) => s + p.pending, 0),
    occupancyRate: totalCapacity > 0 ? totalBooked / totalCapacity : 0,
    avgNights,
    reservationsInPeriod,
    visitsInPeriod: visitsInRange.length,
    visitsCompletionRate: decidedVisits > 0 ? completedVisits / decidedVisits : 0,
  };
}
