import { useEffect, useMemo, useState } from 'react';
import { api, describeApiError } from '../api';
import type { Apartment, Categories, ReservationRecord, SiteTrafficDay } from '../types';
import { AsyncSection, Button, Card, PageHeader, fmtCOP } from '../components/ui';
import { BarChart, ChartCard, Meter, SegmentedBar, StatTile, TrendChart } from '../components/charts';
import {
  PERIOD_OPTIONS, apartmentPerformance, dayLabel, kpiSummary, occupancyByMonth, reservationsCreatedByMonth,
  revenueByMonth, statusBreakdown, todayBoard, type Period,
} from '../lib/analytics';

const TONE_HEX: Record<string, string> = {
  emerald: 'var(--color-emerald)', amber: 'var(--color-amber)', red: 'var(--color-red)', graphite: 'var(--color-graphite-600)',
};
const pct = (n: number) => `${Math.round(n * 100)}%`;

function StayList({ title, empty, records, actionLabel, onAction, busyCode }: {
  title: string; empty: string; records: ReservationRecord[];
  actionLabel?: string; onAction?: (r: ReservationRecord) => void; busyCode?: string | null;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wide text-muted">{title}</h4>
        <span className="rounded-full bg-paper-2 px-2 py-0.5 text-xs font-bold text-ink/70">{records.length}</span>
      </div>
      {records.length === 0 ? (
        <p className="text-xs text-muted">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {records.map((r) => (
            <li key={r.code} className="flex items-center justify-between gap-2 rounded-lg bg-paper-2 px-3 py-2 text-xs">
              <div className="min-w-0">
                <div className="truncate font-bold text-ink">{r.unitLabel}</div>
                <div className="truncate text-muted">{r.name} · {r.code}</div>
              </div>
              {actionLabel && onAction && (
                <Button variant="ghost" disabled={busyCode === r.code} onClick={() => onAction(r)} className="shrink-0 px-2.5 py-1 text-[11px]">
                  {busyCode === r.code ? '...' : actionLabel}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Analytics() {
  const [reservations, setReservations] = useState<ReservationRecord[] | null>(null);
  const [visits, setVisits] = useState<ReservationRecord[] | null>(null);
  const [apartments, setApartments] = useState<Apartment[] | null>(null);
  const [categories, setCategories] = useState<Categories | null>(null);
  const [traffic, setTraffic] = useState<SiteTrafficDay[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('6m');
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    Promise.all([api.getReservations(), api.getVisits(), api.getApartments(), api.getCategories(), api.getSiteTraffic(30)])
      .then(([res, vis, apts, cats, traf]) => {
        setReservations(res); setVisits(vis); setApartments(apts); setCategories(cats); setTraffic(traf);
      })
      .catch((err) => setError(describeApiError(err)))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  const data = useMemo(() => {
    if (!reservations || !visits || !apartments || !categories || !traffic) return null;
    const revenue = revenueByMonth(reservations, period);
    const occupancy = occupancyByMonth(reservations, apartments, period);
    const volume = reservationsCreatedByMonth(reservations, period);
    const kpis = kpiSummary(reservations, visits, apartments, period);
    const resStatus = statusBreakdown(reservations);
    const visitStatus = statusBreakdown(visits);
    const perf = apartmentPerformance(reservations, apartments, categories, period);
    const board = todayBoard(reservations);
    const totalPageviews = traffic.reduce((s, day) => s + day.total, 0);
    const pathCounts = new Map<string, number>();
    for (const day of traffic) for (const [path, count] of Object.entries(day.paths)) pathCounts.set(path, (pathCounts.get(path) ?? 0) + count);
    const topPaths = [...pathCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    const trafficByDay = [...traffic].sort((a, b) => a.day.localeCompare(b.day));
    return { revenue, occupancy, volume, kpis, resStatus, visitStatus, perf, board, totalPageviews, topPaths, trafficByDay };
  }, [reservations, visits, apartments, categories, traffic, period]);

  async function handleCheck(record: ReservationRecord, kind: 'check-in' | 'check-out') {
    setBusyCode(record.code);
    setActionError(null);
    try {
      const updated = kind === 'check-in' ? await api.checkIn(record.code) : await api.checkOut(record.code);
      setReservations((prev) => prev?.map((r) => (r.code === updated.code ? updated : r)) ?? prev);
    } catch (err) {
      setActionError(describeApiError(err));
    } finally {
      setBusyCode(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Analíticas"
        subtitle="Control operativo del negocio — ocupación, ingresos, reservas y visitas, calculado a partir de los mismos datos del panel."
        action={
          <div className="flex flex-wrap gap-2">
            {PERIOD_OPTIONS.map((o) => (
              <button
                key={o.key}
                onClick={() => setPeriod(o.key)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
                  period === o.key ? 'bg-graphite-900 text-white' : 'border border-line text-muted hover:border-gold/60 hover:text-gold-dark'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        }
      />

      <AsyncSection loading={loading} error={error} data={data} onRetry={load}>
        {(d) => (
          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
              <StatTile label="Ingresos verificados" value={fmtCOP(d.kpis.verifiedRevenue)} hint="Transferencias y efectivo ya confirmados" trend={d.revenue.map((p) => p.verified)} trendColor="var(--color-emerald)" />
              <StatTile label="Por verificar" value={fmtCOP(d.kpis.pendingRevenue)} hint="Reportado, esperando verificación" trend={d.revenue.map((p) => p.pending)} trendColor="var(--color-amber)" />
              <StatTile label="Ocupación" value={pct(d.kpis.occupancyRate)} hint="Noches ocupadas / noches disponibles" trend={d.occupancy.map((p) => p.rate)} trendColor="var(--color-gold)" />
              <StatTile label="Noches promedio" value={d.kpis.avgNights.toFixed(1)} hint="Por estadía confirmada/completada" />
              <StatTile label="Reservas creadas" value={String(d.kpis.reservationsInPeriod)} hint="En el período seleccionado" trend={d.volume.map((p) => p.count)} trendColor="var(--color-graphite-600)" />
              <StatTile label="Visitas agendadas" value={String(d.kpis.visitsInPeriod)} hint={`${pct(d.kpis.visitsCompletionRate)} se completaron`} />
            </div>

            <ChartCard title="Ingresos por mes" subtitle="Atribuidos al mes de check-in" legend={[{ label: 'Verificado', color: 'var(--color-emerald)' }, { label: 'Por verificar', color: 'var(--color-amber)' }]}>
              <BarChart
                formatValue={fmtCOP}
                points={d.revenue.map((p) => ({
                  key: p.key, label: p.label,
                  segments: [
                    { name: 'Verificado', value: p.verified, color: 'var(--color-emerald)' },
                    { name: 'Por verificar', value: p.pending, color: 'var(--color-amber)' },
                  ],
                }))}
              />
            </ChartCard>

            <div className="grid gap-6 lg:grid-cols-2">
              <ChartCard title="Ocupación por mes" subtitle="% de noches-apartamento ocupadas">
                <TrendChart points={d.occupancy.map((p) => ({ key: p.key, label: p.label, value: p.rate }))} formatValue={pct} color="var(--color-gold)" />
              </ChartCard>
              <ChartCard title="Reservas creadas por mes" subtitle="Demanda entrante, sin importar su estado actual">
                <BarChart formatValue={(v) => String(Math.round(v))} points={d.volume.map((p) => ({ key: p.key, label: p.label, segments: [{ name: 'Reservas', value: p.count, color: 'var(--color-graphite-600)' }] }))} />
              </ChartCard>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <ChartCard title="Reservas por estado" subtitle="Todas las reservas registradas, cualquier período">
                <SegmentedBar formatValue={(v) => String(v)} segments={d.resStatus.map((s) => ({ name: s.label, value: s.count, color: TONE_HEX[s.tone] }))} />
              </ChartCard>
              <ChartCard title="Visitas por estado" subtitle="Todas las citas registradas, cualquier período">
                <SegmentedBar formatValue={(v) => String(v)} segments={d.visitStatus.map((s) => ({ name: s.label, value: s.count, color: TONE_HEX[s.tone] }))} />
              </ChartCard>
            </div>

            <ChartCard title="Público visitado" subtitle={`Tráfico del sitio público — ${d.totalPageviews} vistas en los últimos 30 días`}>
              <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
                <TrendChart
                  points={d.trafficByDay.map((t) => ({ key: t.day, label: dayLabel(t.day), value: t.total }))}
                  formatValue={(v) => `${Math.round(v)} vistas`}
                  color="var(--color-graphite-600)"
                />
                <div>
                  <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Páginas más vistas</h4>
                  {d.topPaths.length === 0 ? (
                    <p className="text-xs text-muted">Todavía no hay tráfico registrado.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {d.topPaths.map(([path, count]) => (
                        <li key={path} className="flex items-center justify-between gap-2 text-xs">
                          <span className="truncate text-ink/80">{path === '_' ? '/ (inicio)' : path.replace(/_/g, '/')}</span>
                          <span className="shrink-0 font-bold tabular-nums text-ink">{count}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </ChartCard>

            <ChartCard title="Hoy" subtitle="Basado en el check-in/check-out de reservas confirmadas">
              {actionError && <p className="mb-3 rounded-xl bg-red/10 px-3.5 py-2.5 text-sm text-red-dark">{actionError}</p>}
              <div className="grid gap-6 sm:grid-cols-3">
                <StayList
                  title="Llegan hoy" empty="Nadie llega hoy." records={d.board.arrivals}
                  actionLabel="Check-in" busyCode={busyCode}
                  onAction={(r) => handleCheck(r, 'check-in')}
                />
                <StayList
                  title="Salen hoy" empty="Nadie sale hoy." records={d.board.departures}
                  actionLabel="Check-out" busyCode={busyCode}
                  onAction={(r) => handleCheck(r, 'check-out')}
                />
                <StayList title="En casa ahora" empty="Ningún apartamento ocupado hoy." records={d.board.inHouse} />
              </div>
            </ChartCard>

            <div>
              <h3 className="mb-3 font-display text-base font-semibold text-ink">Rendimiento por apartamento</h3>
              <Card className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                      <th className="px-4 py-3">Apartamento</th>
                      <th className="px-4 py-3">Categoría</th>
                      <th className="px-4 py-3">Noches ocupadas</th>
                      <th className="px-4 py-3">Ocupación</th>
                      <th className="px-4 py-3">Ingresos (prorrateados)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.perf.map((a) => (
                      <tr key={a.key} className="border-b border-line last:border-0">
                        <td className="px-4 py-3 font-bold text-ink">{a.label}</td>
                        <td className="px-4 py-3 text-ink/70">{a.category}</td>
                        <td className="px-4 py-3 text-ink/70">{a.nights}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16"><Meter value={a.occupancyRate} tone="var(--color-gold)" /></div>
                            <span className="text-xs text-muted">{pct(a.occupancyRate)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-bold text-emerald-dark">{fmtCOP(a.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          </div>
        )}
      </AsyncSection>
    </div>
  );
}
