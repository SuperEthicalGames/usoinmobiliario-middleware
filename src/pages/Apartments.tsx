import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api';
import type { Apartment, OperationalStatus } from '../types';
import { AsyncSection, Card, PageHeader, fmtCOP } from '../components/ui';
import { StatusBadge } from '../components/StatusBadge';

const FILTERS: { key: OperationalStatus | 'todos'; label: string }[] = [
  { key: 'todos', label: 'Todo' },
  { key: 'disponible', label: 'Disponible' },
  { key: 'en-uso', label: 'En uso' },
  { key: 'reservado', label: 'Reservado' },
];

export function Apartments() {
  const [data, setData] = useState<Apartment[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<OperationalStatus | 'todos'>('todos');

  function load() {
    setLoading(true);
    setError(null);
    api.getApartments()
      .then((apts) => setData(apts.sort((a, b) => a.typeKey.localeCompare(b.typeKey) || a.num.localeCompare(b.num))))
      .catch((err) => setError(err instanceof ApiError ? `No se pudieron cargar los apartamentos (${err.code}).` : 'No se pudieron cargar los apartamentos.'))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  const filtered = useMemo(() => {
    if (!data) return data;
    if (filter === 'todos') return data;
    return data.filter((a) => (a.effectiveStatus ?? a.status) === filter);
  }, [data, filter]);

  return (
    <div>
      <PageHeader title="Apartamentos" subtitle="Estado efectivo — ya considera reservas confirmadas, no solo el campo manual." />
      <div className="mb-4 flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
              filter === f.key ? 'bg-forest text-paper' : 'border border-line text-ink/60 hover:border-clay'
            }`}
          >
            {f.label}{data && f.key !== 'todos' ? ` (${data.filter((a) => (a.effectiveStatus ?? a.status) === f.key).length})` : ''}
          </button>
        ))}
      </div>
      <AsyncSection loading={loading} error={error} data={filtered} empty="No hay apartamentos con este estado." onRetry={load}>
        {(apts) => (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {apts.map((apt) => (
              <Card key={apt._key} className="p-5">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="font-display text-lg font-semibold text-ink">Apartamento H{apt.num}</div>
                  <StatusBadge status={apt.effectiveStatus ?? apt.status} />
                </div>
                <div className="text-xs uppercase tracking-wide text-ink/50">{apt.typeKey}</div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-sm text-ink/70">
                  <div>{apt.area} m²</div>
                  <div>{apt.maxPersons} huésp.</div>
                  <div>{apt.baths} baño{apt.baths === 1 ? '' : 's'}</div>
                </div>
                {apt.rates?.month != null && (
                  <div className="mt-3 border-t border-line pt-3 text-sm">
                    <span className="text-ink/50">Desde </span>
                    <span className="font-bold text-forest">{fmtCOP(apt.rates.month)}</span>
                    <span className="text-ink/50"> /mes</span>
                  </div>
                )}
                {apt.status !== (apt.effectiveStatus ?? apt.status) && (
                  <div className="mt-2 text-xs text-ochre">Campo manual: {apt.status}</div>
                )}
              </Card>
            ))}
          </div>
        )}
      </AsyncSection>
    </div>
  );
}
