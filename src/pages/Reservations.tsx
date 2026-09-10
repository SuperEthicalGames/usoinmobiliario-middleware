import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, describeApiError } from '../api';
import type { ReservationRecord, ReservationStatus } from '../types';
import { AsyncSection, Card, PageHeader, Button, fmtCOP, fmtDate } from '../components/ui';
import { StatusBadge, PaymentBadge } from '../components/StatusBadge';
import { RecordDetail } from '../components/RecordDetail';
import { PlusIcon, SearchIcon } from '../components/icons';

const STATUS_FILTERS: { key: ReservationStatus | 'todos'; label: string }[] = [
  { key: 'todos', label: 'Todas' },
  { key: 'pendiente', label: 'Pendientes' },
  { key: 'confirmada', label: 'Confirmadas' },
  { key: 'rechazada', label: 'Rechazadas' },
  { key: 'cancelada', label: 'Canceladas' },
  { key: 'completada', label: 'Completadas' },
];

export function Reservations() {
  const [data, setData] = useState<ReservationRecord[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ReservationStatus | 'todos'>('todos');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ReservationRecord | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    api.getReservations()
      .then((recs) => setData(recs.sort((a, b) => b.createdAt.localeCompare(a.createdAt))))
      .catch((err) => setError(describeApiError(err)))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  const filtered = useMemo(() => {
    if (!data) return data;
    let out = filter === 'todos' ? data : data.filter((r) => r.status === filter);
    const q = search.trim().toUpperCase();
    if (q) out = out.filter((r) => r.code.includes(q) || r.name.toUpperCase().includes(q));
    return out;
  }, [data, filter, search]);

  function handleUpdated(updated: ReservationRecord) {
    setData((prev) => prev?.map((r) => (r.code === updated.code ? updated : r)) ?? prev);
    setSelected(updated);
  }

  return (
    <div>
      <PageHeader
        title="Reservas"
        subtitle="Estadías — cada una nace pendiente con un HOLD de 15 minutos."
        action={<Link to="/reservas/nueva"><Button><PlusIcon className="h-4 w-4" />Nueva reserva</Button></Link>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
                filter === f.key ? 'bg-graphite-900 text-white' : 'border border-line text-muted hover:border-gold/60 hover:text-gold-dark'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-full max-w-xs">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por código o nombre..."
            className="w-full rounded-lg border border-line bg-card py-1.5 pl-9 pr-3 text-sm outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/15"
          />
        </div>
      </div>

      <AsyncSection loading={loading} error={error} data={filtered} empty="No hay reservas con este filtro." onRetry={load}>
        {(recs) => (
          <Card className="overflow-hidden">
            <p className="border-b border-line px-4 py-2 text-xs text-muted">Toca una fila para ver el detalle completo y confirmar, rechazar, cancelar o completar.</p>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-4 py-3">Código</th>
                    <th className="px-4 py-3">Unidad</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Fechas</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3" title="Estado de la reserva en sí: pendiente/confirmada/rechazada/cancelada/completada">Estado</th>
                    <th className="px-4 py-3" title="Estado del pago, independiente del estado de la reserva">Pago</th>
                  </tr>
                </thead>
                <tbody>
                  {recs.map((r) => (
                    <tr key={r.code} onClick={() => setSelected(r)} className="cursor-pointer border-b border-line last:border-0 hover:bg-paper-2">
                      <td className="px-4 py-3 font-bold text-ink">{r.code}</td>
                      <td className="px-4 py-3">{r.unitLabel}</td>
                      <td className="px-4 py-3">{r.name}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-ink/70">{fmtDate(r.checkin)} → {fmtDate(r.checkout)}</td>
                      <td className="px-4 py-3">{fmtCOP(r.estTotal)}</td>
                      <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-3">{r.paymentStatus && <PaymentBadge status={r.paymentStatus} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-line md:hidden">
              {recs.map((r) => (
                <button key={r.code} onClick={() => setSelected(r)} className="flex w-full flex-col gap-2 px-4 py-4 text-left transition hover:bg-paper-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-ink">{r.code}</span>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="text-sm text-ink/80">{r.unitLabel} · {r.name}</div>
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted">
                    <span>{fmtDate(r.checkin)} → {fmtDate(r.checkout)}</span>
                    <span className="font-bold text-ink/70">{fmtCOP(r.estTotal)}</span>
                  </div>
                  {r.paymentStatus && <div><PaymentBadge status={r.paymentStatus} /></div>}
                </button>
              ))}
            </div>
          </Card>
        )}
      </AsyncSection>

      {selected && <RecordDetail record={selected} onClose={() => setSelected(null)} onUpdated={handleUpdated} />}
    </div>
  );
}
