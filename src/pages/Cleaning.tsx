import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, describeApiError } from '../api';
import type { Apartment, Categories, CleaningStatus, CleaningTask } from '../types';
import { AsyncSection, Button, Card, Field, PageHeader, Select, fmtDate } from '../components/ui';
import { CleaningStatusBadge } from '../components/StatusBadge';

const STATUS_FILTERS: { key: CleaningStatus | 'todos'; label: string }[] = [
  { key: 'todos', label: 'Todas' },
  { key: 'pendiente', label: 'Pendientes' },
  { key: 'en-progreso', label: 'En progreso' },
  { key: 'completado', label: 'Completadas' },
];
const NEXT_STATUS: Record<CleaningStatus, CleaningStatus | null> = {
  pendiente: 'en-progreso', 'en-progreso': 'completado', completado: null,
};
const NEXT_LABEL: Record<CleaningStatus, string> = { pendiente: 'Iniciar', 'en-progreso': 'Marcar completada', completado: '' };

function CreateTaskForm({ apartments, categoryLabel, onCreated }: {
  apartments: Apartment[]; categoryLabel: (t: string) => string; onCreated: (t: CleaningTask) => void;
}) {
  const [selectedKey, setSelectedKey] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = apartments.find((a) => a._key === selectedKey);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.createCleaningTask({
        unitType: selected.typeKey, unitNum: selected.num, unitLabel: `Apartamento H${selected.num}`,
        scheduledDate, assignedTo: assignedTo || undefined,
      });
      onCreated(created);
      setSelectedKey(''); setScheduledDate(''); setAssignedTo('');
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="p-6">
      <h2 className="mb-1 font-display text-lg font-semibold text-ink">Programar aseo</h2>
      <p className="mb-4 text-sm text-muted">Un check-out registrado desde Reservas ya crea esta tarea solo — usa esto para programar aseo aparte (ej. mantenimiento preventivo).</p>
      <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
        <Select label="Apartamento" required value={selectedKey} onChange={(e) => setSelectedKey(e.target.value)} className="w-full sm:w-auto">
          <option value="">Selecciona...</option>
          {apartments.map((a) => (
            <option key={a._key} value={a._key}>Apartamento H{a.num} — {categoryLabel(a.typeKey)}</option>
          ))}
        </Select>
        <Field label="Fecha" type="date" required value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className="w-full sm:w-auto" />
        <Field label="Asignado a (opcional)" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className="w-full sm:w-auto" />
        <Button type="submit" disabled={submitting || !selected} className="w-full sm:w-auto">{submitting ? 'Creando...' : 'Programar'}</Button>
      </form>
      {error && <p className="mt-3 text-sm text-red-dark">{error}</p>}
    </Card>
  );
}

export function Cleaning() {
  const [data, setData] = useState<CleaningTask[] | null>(null);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [categories, setCategories] = useState<Categories | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<CleaningStatus | 'todos'>('todos');
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    Promise.all([api.getCleaningTasks(), api.getApartments(), api.getCategories()])
      .then(([tasks, apts, cats]) => {
        setData(tasks.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate)));
        setApartments(apts);
        setCategories(cats);
      })
      .catch((err) => setError(describeApiError(err)))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  function categoryLabel(typeKey: string): string {
    return categories?.[typeKey]?.catLabel?.es ?? typeKey;
  }

  const filtered = useMemo(() => {
    if (!data) return data;
    return filter === 'todos' ? data : data.filter((t) => t.status === filter);
  }, [data, filter]);

  async function advance(task: CleaningTask) {
    const next = NEXT_STATUS[task.status];
    if (!next) return;
    setBusyCode(task.code);
    setActionError(null);
    try {
      const updated = await api.setCleaningStatus(task.code, next);
      setData((prev) => prev?.map((t) => (t.code === task.code ? updated : t)) ?? prev);
    } catch (err) {
      setActionError(describeApiError(err));
    } finally {
      setBusyCode(null);
    }
  }

  return (
    <div>
      <PageHeader title="Aseo" subtitle="Tareas de limpieza entre huéspedes — el check-out real ya programa la de salida automáticamente." />
      <div className="space-y-6">
        <CreateTaskForm apartments={apartments} categoryLabel={categoryLabel} onCreated={(t) => setData((prev) => (prev ? [t, ...prev] : [t]))} />

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

        {actionError && <p className="rounded-xl bg-red/10 px-3.5 py-2.5 text-sm text-red-dark">{actionError}</p>}

        <AsyncSection loading={loading} error={error} data={filtered} empty="No hay tareas de aseo con este filtro." onRetry={load}>
          {(tasks) => (
            <Card className="divide-y divide-line">
              {tasks.map((t) => (
                <div key={t.code} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-ink">{t.unitLabel}</span>
                      <CleaningStatusBadge status={t.status} />
                      {t.relatedReservationCode && <span className="text-xs text-muted">de salida · {t.relatedReservationCode}</span>}
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      {fmtDate(t.scheduledDate)} · {t.code}{t.assignedTo ? ` · ${t.assignedTo}` : ''}
                    </div>
                    {t.notes && <div className="mt-1 text-xs text-ink/70">{t.notes}</div>}
                  </div>
                  {NEXT_STATUS[t.status] && (
                    <Button disabled={busyCode === t.code} onClick={() => advance(t)} className="shrink-0">
                      {busyCode === t.code ? '...' : NEXT_LABEL[t.status]}
                    </Button>
                  )}
                </div>
              ))}
            </Card>
          )}
        </AsyncSection>
      </div>
    </div>
  );
}
