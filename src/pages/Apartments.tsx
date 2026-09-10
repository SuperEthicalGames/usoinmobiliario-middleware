import { useEffect, useMemo, useState } from 'react';
import { api, describeApiError } from '../api';
import type { Apartment, Categories, OperationalStatus, ReservationRecord } from '../types';
import { AsyncSection, Card, PageHeader, fmtCOP, fmtDate } from '../components/ui';
import { OperationalStatusBadge } from '../components/StatusBadge';
import { AlertIcon, CalendarIcon } from '../components/icons';
import { RecordDetail } from '../components/RecordDetail';
import { todayIsoBogota } from '../lib/analytics';

const STATUS_FILTERS: { key: OperationalStatus | 'todos'; label: string; active: string }[] = [
  { key: 'todos', label: 'Todo', active: 'bg-graphite-900 text-white' },
  { key: 'disponible', label: 'Disponible', active: 'bg-emerald text-white' },
  { key: 'en-uso', label: 'En uso', active: 'bg-amber text-white' },
  { key: 'reservado', label: 'Reservado', active: 'bg-gold text-ink' },
];

// Colores fijos por categoría (no por status) para que un vistazo rápido a la grilla ya
// diferencie 1 Ambiente de 2 Ambientes sin tener que leer el texto de cada tarjeta.
const CATEGORY_DOT: Record<string, string> = { estudio: 'bg-emerald', dos: 'bg-gold' };

function FilterPill({ active, activeClass, children, ...rest }: { active: boolean; activeClass: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
        active ? activeClass : 'border border-line text-muted hover:border-gold/60 hover:text-gold-dark'
      }`}
    >
      {children}
    </button>
  );
}

// Reserva relevante para explicar POR QUÉ un apartamento está en-uso/reservado — la estadía en
// curso ahora mismo, o si no hay ninguna, la próxima confirmada que se aproxima. Antes la
// tarjeta solo mostraba el status sin decir de quién ni hasta cuándo, obligando a ir a Reservas
// y buscar la unidad a mano.
//
// Un HOLD 'pendiente' vigente cuenta igual que una confirmada — mismo criterio que
// effectiveStatus en el backend (ver firebase.js): el cliente ya está a mitad de una reserva
// real, la tarjeta tiene que poder explicar eso aunque el admin todavía no la haya confirmado.
function isLiveHold(r: ReservationRecord): boolean {
  return r.status === 'pendiente' && (!r.expiresAt || r.paymentStatus === 'submitted' || r.expiresAt >= Date.now());
}
function relevantStayFor(apt: Apartment, reservations: ReservationRecord[], today: string): ReservationRecord | null {
  const stays = reservations.filter((r) =>
    r.type === 'reserva' && (r.status === 'confirmada' || isLiveHold(r)) && r.unitType === apt.typeKey && r.unitNum === apt.num && r.checkin && r.checkout);
  const current = stays.find((r) => r.checkin! <= today && today < r.checkout!);
  if (current) return current;
  const upcoming = stays.filter((r) => r.checkin! > today).sort((a, b) => a.checkin!.localeCompare(b.checkin!));
  return upcoming[0] ?? null;
}

export function Apartments() {
  const [data, setData] = useState<Apartment[] | null>(null);
  const [categories, setCategories] = useState<Categories | null>(null);
  const [reservations, setReservations] = useState<ReservationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<OperationalStatus | 'todos'>('todos');
  const [categoryFilter, setCategoryFilter] = useState<string | 'todas'>('todas');
  const [selected, setSelected] = useState<ReservationRecord | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    Promise.all([api.getApartments(), api.getCategories(), api.getReservations()])
      .then(([apts, cats, recs]) => {
        setData(apts.sort((a, b) => a.typeKey.localeCompare(b.typeKey) || a.num.localeCompare(b.num)));
        setCategories(cats);
        setReservations(recs);
      })
      .catch((err) => setError(describeApiError(err)))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  function categoryLabel(typeKey: string): string {
    return categories?.[typeKey]?.catLabel?.es ?? typeKey;
  }

  const today = useMemo(() => todayIsoBogota(), []);

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

  function handleUpdated(updated: ReservationRecord) {
    setReservations((prev) => prev.map((r) => (r.code === updated.code ? updated : r)));
    setSelected(updated);
  }

  return (
    <div>
      <PageHeader
        title="Apartamentos"
        subtitle="El estado que se muestra ya considera reservas confirmadas — puede diferir del campo manual que se edita en Firebase."
      />
      <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <FilterPill key={f.key} active={statusFilter === f.key} activeClass={f.active} onClick={() => setStatusFilter(f.key)}>
              {f.label}{data && f.key !== 'todos' ? ` (${data.filter((a) => (a.effectiveStatus ?? a.status) === f.key).length})` : ''}
            </FilterPill>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 border-l border-line pl-5">
          <FilterPill active={categoryFilter === 'todas'} activeClass="bg-graphite-900 text-white" onClick={() => setCategoryFilter('todas')}>
            Todas las categorías
          </FilterPill>
          {categoryOptions.map((typeKey) => (
            <FilterPill key={typeKey} active={categoryFilter === typeKey} activeClass="bg-graphite-900 text-white" onClick={() => setCategoryFilter(typeKey)}>
              {categoryLabel(typeKey)}
            </FilterPill>
          ))}
        </div>
      </div>
      <AsyncSection loading={loading} error={error} data={filtered} empty="No hay apartamentos con este filtro." onRetry={load}>
        {(apts) => (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {apts.map((apt) => {
              const effective = apt.effectiveStatus ?? apt.status;
              const stay = effective !== 'disponible' ? relevantStayFor(apt, reservations, today) : null;
              const isCurrent = stay ? stay.checkin! <= today && today < stay.checkout! : false;
              return (
                <Card key={apt._key} className="p-5" hoverable>
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="font-display text-lg font-semibold text-ink">Apartamento H{apt.num}</div>
                    <OperationalStatusBadge status={effective} />
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
                    <span className={`h-2 w-2 rounded-full ${CATEGORY_DOT[apt.typeKey] ?? 'bg-graphite-400'}`} />
                    {categoryLabel(apt.typeKey)}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-sm text-ink/70">
                    <div>{apt.area} m²</div>
                    <div>{apt.maxPersons} huésp.</div>
                    <div>{apt.baths} baño{apt.baths === 1 ? '' : 's'}</div>
                  </div>
                  {apt.rates?.month != null && (
                    <div className="mt-3 border-t border-line pt-3 text-sm">
                      <span className="text-muted">Desde </span>
                      <span className="font-bold text-emerald-dark">{fmtCOP(apt.rates.month)}</span>
                      <span className="text-muted"> /mes</span>
                    </div>
                  )}
                  {stay ? (
                    <button
                      onClick={() => setSelected(stay)}
                      className={`mt-3 w-full rounded-xl border px-3 py-2.5 text-left text-xs transition hover:border-gold/60 ${
                        stay.status === 'pendiente' ? 'border-amber/30 bg-amber/5' : 'border-line bg-paper-2'
                      }`}
                    >
                      <div className="mb-1 flex items-center gap-1.5 font-bold uppercase tracking-wide text-muted">
                        <CalendarIcon className="h-3.5 w-3.5" />
                        {stay.status === 'pendiente' ? 'Solicitud en curso (HOLD, sin confirmar)' : isCurrent ? 'Huésped actual' : 'Próximo huésped'}
                      </div>
                      <div className="font-bold text-ink">{stay.name}</div>
                      <div className="mt-0.5 text-ink/70">{fmtDate(stay.checkin)} → {fmtDate(stay.checkout)} · {stay.code}</div>
                    </button>
                  ) : effective !== 'disponible' ? (
                    <div className="mt-3 rounded-xl border border-dashed border-line px-3 py-2.5 text-xs text-muted">
                      Sin reserva ni solicitud pendiente asociada — el estado viene del campo manual en Firebase.
                    </div>
                  ) : null}
                  {apt.status !== effective && (
                    <div
                      className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber/10 px-2.5 py-1.5 text-xs text-amber-dark"
                      title="El campo manual en Firebase dice algo distinto, pero hay una reserva confirmada que manda sobre él"
                    >
                      <AlertIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Campo manual dice "{apt.status}" — mostrando el real
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </AsyncSection>

      {selected && <RecordDetail record={selected} onClose={() => setSelected(null)} onUpdated={handleUpdated} />}
    </div>
  );
}
