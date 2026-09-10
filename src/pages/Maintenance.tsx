import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, describeApiError } from '../api';
import type { Apartment, Categories, MaintenancePriority, MaintenanceStatus, MaintenanceTicket } from '../types';
import { AsyncSection, Button, Card, Field, PageHeader, Select, TextArea } from '../components/ui';
import { MaintenanceStatusBadge, PriorityBadge } from '../components/StatusBadge';

const STATUS_FILTERS: { key: MaintenanceStatus | 'todos'; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'abierto', label: 'Abiertos' },
  { key: 'en-progreso', label: 'En progreso' },
  { key: 'resuelto', label: 'Resueltos' },
];
const NEXT_STATUS: Record<MaintenanceStatus, MaintenanceStatus | null> = {
  abierto: 'en-progreso', 'en-progreso': 'resuelto', resuelto: null,
};
const NEXT_LABEL: Record<MaintenanceStatus, string> = { abierto: 'Tomar', 'en-progreso': 'Marcar resuelto', resuelto: '' };

function CreateTicketForm({ apartments, categoryLabel, onCreated }: {
  apartments: Apartment[]; categoryLabel: (t: string) => string; onCreated: (t: MaintenanceTicket) => void;
}) {
  const [selectedKey, setSelectedKey] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<MaintenancePriority>('media');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = apartments.find((a) => a._key === selectedKey);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.createMaintenanceTicket({
        unitType: selected.typeKey, unitNum: selected.num, unitLabel: `Apartamento H${selected.num}`,
        title, description: description || undefined, priority,
      });
      onCreated(created);
      setSelectedKey(''); setTitle(''); setDescription(''); setPriority('media');
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="p-6">
      <h2 className="mb-1 font-display text-lg font-semibold text-ink">Reportar falla</h2>
      <p className="mb-4 text-sm text-muted">Cualquier problema del apartamento que necesite atención — no bloquea reservas ni cambia su estado.</p>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label="Apartamento" required value={selectedKey} onChange={(e) => setSelectedKey(e.target.value)}>
            <option value="">Selecciona...</option>
            {apartments.map((a) => (
              <option key={a._key} value={a._key}>Apartamento H{a.num} — {categoryLabel(a.typeKey)}</option>
            ))}
          </Select>
          <Select label="Prioridad" value={priority} onChange={(e) => setPriority(e.target.value as MaintenancePriority)}>
            <option value="baja">Baja</option>
            <option value="media">Media</option>
            <option value="alta">Alta</option>
          </Select>
        </div>
        <Field label="Título" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Aire acondicionado no enfría" />
        <TextArea label="Descripción (opcional)" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        {error && <p className="text-sm text-red-dark">{error}</p>}
        <Button type="submit" disabled={submitting || !selected}>{submitting ? 'Creando...' : 'Reportar'}</Button>
      </form>
    </Card>
  );
}

export function Maintenance() {
  const [data, setData] = useState<MaintenanceTicket[] | null>(null);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [categories, setCategories] = useState<Categories | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<MaintenanceStatus | 'todos'>('todos');
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    Promise.all([api.getMaintenanceTickets(), api.getApartments(), api.getCategories()])
      .then(([tickets, apts, cats]) => {
        const priorityRank: Record<MaintenancePriority, number> = { alta: 0, media: 1, baja: 2 };
        setData(tickets.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || b.createdAt.localeCompare(a.createdAt)));
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

  async function advance(ticket: MaintenanceTicket) {
    const next = NEXT_STATUS[ticket.status];
    if (!next) return;
    setBusyCode(ticket.code);
    setActionError(null);
    try {
      const updated = await api.setMaintenanceStatus(ticket.code, next);
      setData((prev) => prev?.map((t) => (t.code === ticket.code ? updated : t)) ?? prev);
    } catch (err) {
      setActionError(describeApiError(err));
    } finally {
      setBusyCode(null);
    }
  }

  return (
    <div>
      <PageHeader title="Mantenimiento" subtitle="Fallas y pedidos reportados sobre un apartamento." />
      <div className="space-y-6">
        <CreateTicketForm apartments={apartments} categoryLabel={categoryLabel} onCreated={(t) => setData((prev) => (prev ? [t, ...prev] : [t]))} />

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

        <AsyncSection loading={loading} error={error} data={filtered} empty="No hay tickets de mantenimiento con este filtro." onRetry={load}>
          {(tickets) => (
            <Card className="divide-y divide-line">
              {tickets.map((t) => (
                <div key={t.code} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-ink">{t.unitLabel}</span>
                      <PriorityBadge priority={t.priority} />
                      <MaintenanceStatusBadge status={t.status} />
                    </div>
                    <div className="mt-1 text-sm text-ink/80">{t.title}</div>
                    {t.description && <div className="mt-1 text-xs text-ink/70">{t.description}</div>}
                    <div className="mt-1 text-xs text-muted">{t.code}{t.reportedBy ? ` · ${t.reportedBy}` : ''}</div>
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
