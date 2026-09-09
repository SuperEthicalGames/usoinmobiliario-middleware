import { useEffect, useMemo, useState } from 'react';
import { api, describeApiError } from '../api';
import type { Apartment, Categories, OperationalStatus } from '../types';
import { AsyncSection, Card, PageHeader, fmtCOP } from '../components/ui';
import { StatusBadge } from '../components/StatusBadge';

const STATUS_FILTERS: { key: OperationalStatus | 'todos'; label: string }[] = [
  { key: 'todos', label: 'Todo' },
  { key: 'disponible', label: 'Disponible' },
  { key: 'en-uso', label: 'En uso' },
  { key: 'reservado', label: 'Reservado' },
];

// Colores fijos por categoría (no por status) para que un vistazo rápido a la grilla ya
// diferencie 1 Ambiente de 2 Ambientes sin tener que leer el texto de cada tarjeta.
const CATEGORY_DOT: Record<string, string> = { estudio: 'bg-forest', dos: 'bg-clay' };

export function Apartments() {
  const [data, setData] = useState<Apartment[] | null>(null);
  const [categories, setCategories] = useState<Categories | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<OperationalStatus | 'todos'>('todos');
  const [categoryFilter, setCategoryFilter] = useState<string | 'todas'>('todas');

  function load() {
    setLoading(true);
    setError(null);
    Promise.all([api.getApartments(), api.getCategories()])
      .then(([apts, cats]) => {
        setData(apts.sort((a, b) => a.typeKey.localeCompare(b.typeKey) || a.num.localeCompare(b.num)));
        setCategories(cats);
      })
      .catch((err) => setError(describeApiError(err)))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  function categoryLabel(typeKey: string): string {
    return categories?.[typeKey]?.catLabel?.es ?? typeKey;
  }

  const categoryOptions = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.map((a) => a.typeKey))];
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return data;
    return data.filter((a) => {
      if (statusFilter !== 'todos' && (a.effectiveStatus ?? a.status) !== statusFilter) return false;
      if (categoryFilter !== 'todas' && a.typeKey !== categoryFilter) return false;
      return true;
    });
  }, [data, statusFilter, categoryFilter]);

  return (
    <div>
      <PageHeader
        title="Apartamentos"
        subtitle="El estado que se muestra ya considera reservas confirmadas — puede diferir del campo manual que se edita en Firebase."
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
                statusFilter === f.key ? 'bg-forest text-paper' : 'border border-line text-ink/60 hover:border-clay'
              }`}
            >
              {f.label}{data && f.key !== 'todos' ? ` (${data.filter((a) => (a.effectiveStatus ?? a.status) === f.key).length})` : ''}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 border-l border-line pl-3">
          <button
            onClick={() => setCategoryFilter('todas')}
            className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
              categoryFilter === 'todas' ? 'bg-ink text-paper' : 'border border-line text-ink/60 hover:border-clay'
            }`}
          >
            Todas las categorías
          </button>
          {categoryOptions.map((typeKey) => (
            <button
              key={typeKey}
              onClick={() => setCategoryFilter(typeKey)}
              className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
                categoryFilter === typeKey ? 'bg-ink text-paper' : 'border border-line text-ink/60 hover:border-clay'
              }`}
            >
              {categoryLabel(typeKey)}
            </button>
          ))}
        </div>
      </div>
      <AsyncSection loading={loading} error={error} data={filtered} empty="No hay apartamentos con este filtro." onRetry={load}>
        {(apts) => (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {apts.map((apt) => (
              <Card key={apt._key} className="p-5">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="font-display text-lg font-semibold text-ink">Apartamento H{apt.num}</div>
                  <StatusBadge status={apt.effectiveStatus ?? apt.status} />
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink/60">
                  <span className={`h-2 w-2 rounded-full ${CATEGORY_DOT[apt.typeKey] ?? 'bg-ink/40'}`} />
                  {categoryLabel(apt.typeKey)}
                </div>
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
                  <div className="mt-2 text-xs text-ochre" title="El campo manual en Firebase dice algo distinto, pero hay una reserva confirmada que manda sobre él">
                    ⚠️ Campo manual dice "{apt.status}" — mostrando el real
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </AsyncSection>
    </div>
  );
}
