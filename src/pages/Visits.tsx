import { useEffect, useMemo, useState } from 'react';
import { api, describeApiError } from '../api';
import type { ReservationRecord, ReservationStatus } from '../types';
import { AsyncSection, Card, PageHeader, fmtDate } from '../components/ui';
import { StatusBadge } from '../components/StatusBadge';
import { RecordDetail } from '../components/RecordDetail';

const STATUS_FILTERS: { key: ReservationStatus | 'todos'; label: string }[] = [
  { key: 'todos', label: 'Todas' },
  { key: 'pendiente', label: 'Pendientes' },
  { key: 'confirmada', label: 'Confirmadas' },
  { key: 'rechazada', label: 'Rechazadas' },
  { key: 'cancelada', label: 'Canceladas' },
  { key: 'completada', label: 'Completadas' },
];

export function Visits() {
  const [data, setData] = useState<ReservationRecord[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ReservationStatus | 'todos'>('todos');
  const [selected, setSelected] = useState<ReservationRecord | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    api.getVisits()
      .then((recs) => setData(recs.sort((a, b) => (a.visitDate ?? '').localeCompare(b.visitDate ?? ''))))
      .catch((err) => setError(describeApiError(err)))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  const filtered = useMemo(() => {
    if (!data) return data;
    return filter === 'todos' ? data : data.filter((r) => r.status === filter);
  }, [data, filter]);

  function handleUpdated(updated: ReservationRecord) {
    setData((prev) => prev?.map((r) => (r.code === updated.code ? updated : r)) ?? prev);
    setSelected(updated);
  }

  return (
    <div>
      <PageHeader title="Visitas" subtitle="Citas para conocer un apartamento — específicas o generales, no bloquean fechas de alojamiento." />
      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
              filter === f.key ? 'bg-forest text-paper' : 'border border-line text-ink/60 hover:border-clay'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <AsyncSection loading={loading} error={error} data={filtered} empty="No hay visitas con este filtro." onRetry={load}>
        {(visits) => (
          <Card className="overflow-x-auto">
            <p className="border-b border-line px-4 py-2 text-xs text-ink/40">Clic en una fila para ver el detalle y confirmar, rechazar, cancelar o completar.</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink/50">
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Unidad</th>
                  <th className="px-4 py-3" title="Específica: a un apartamento en particular. General: quiere conocer varias opciones.">Tipo de visita</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Hora</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {visits.map((v) => (
                  <tr key={v.code} onClick={() => setSelected(v)} className="cursor-pointer border-b border-line last:border-0 hover:bg-sand/60">
                    <td className="px-4 py-3 font-bold">{v.code}</td>
                    <td className="px-4 py-3">{v.unitLabel}</td>
                    <td className="px-4 py-3 text-ink/70">{v.appointmentType === 'general_visit' ? 'General' : 'Específica'}</td>
                    <td className="px-4 py-3">{v.name}</td>
                    <td className="px-4 py-3">{fmtDate(v.visitDate)}</td>
                    <td className="px-4 py-3">{v.visitTime}</td>
                    <td className="px-4 py-3"><StatusBadge status={v.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </AsyncSection>

      {selected && <RecordDetail record={selected} onClose={() => setSelected(null)} onUpdated={handleUpdated} />}
    </div>
  );
}
