import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, describeApiError } from '../api';
import type { Apartment, Categories, Contract, ContractStatus } from '../types';
import { AsyncSection, Button, Card, Field, PageHeader, Select, TextArea, fmtCOP, fmtDate } from '../components/ui';
import { ContractStatusBadge } from '../components/StatusBadge';

const STATUS_FILTERS: { key: ContractStatus | 'todos'; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'activo', label: 'Activos' },
  { key: 'finalizado', label: 'Finalizados' },
  { key: 'cancelado', label: 'Cancelados' },
];

function CreateContractForm({ apartments, categoryLabel, onCreated }: {
  apartments: Apartment[]; categoryLabel: (t: string) => string; onCreated: (c: Contract) => void;
}) {
  const [selectedKey, setSelectedKey] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');
  const [tenantEmail, setTenantEmail] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [monthlyRent, setMonthlyRent] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = apartments.find((a) => a._key === selectedKey);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.createContract({
        unitType: selected.typeKey, unitNum: selected.num, unitLabel: `Apartamento H${selected.num}`,
        tenantName, tenantPhone, tenantEmail, startDate, endDate,
        monthlyRent: Number(monthlyRent), depositAmount: Number(depositAmount) || 0,
        notes: notes || undefined,
      });
      onCreated(created);
      setSelectedKey(''); setTenantName(''); setTenantPhone(''); setTenantEmail('');
      setStartDate(''); setEndDate(''); setMonthlyRent(''); setDepositAmount(''); setNotes('');
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="p-6">
      <h2 className="mb-1 font-display text-lg font-semibold text-ink">Nuevo contrato</h2>
      <p className="mb-4 text-sm text-muted">Arriendo formal de largo plazo — independiente de las reservas cortas del apartamento.</p>
      <form onSubmit={onSubmit} className="space-y-4">
        <Select label="Apartamento" required value={selectedKey} onChange={(e) => setSelectedKey(e.target.value)}>
          <option value="">Selecciona un apartamento...</option>
          {apartments.map((a) => (
            <option key={a._key} value={a._key}>Apartamento H{a.num} — {categoryLabel(a.typeKey)}</option>
          ))}
        </Select>
        <Field label="Nombre del inquilino" required value={tenantName} onChange={(e) => setTenantName(e.target.value)} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Teléfono" value={tenantPhone} onChange={(e) => setTenantPhone(e.target.value)} />
          <Field label="Correo" type="email" value={tenantEmail} onChange={(e) => setTenantEmail(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Fecha de inicio" type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Field label="Fecha de fin" type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Renta mensual (COP)" type="number" min={1} required value={monthlyRent} onChange={(e) => setMonthlyRent(e.target.value)} />
          <Field label="Depósito (COP, opcional)" type="number" min={0} value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} />
        </div>
        <TextArea label="Notas (opcional)" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        {error && <p className="rounded-xl bg-red/10 px-3.5 py-2.5 text-sm text-red-dark">{error}</p>}
        <Button type="submit" disabled={submitting || !selected}>{submitting ? 'Creando...' : 'Crear contrato'}</Button>
      </form>
    </Card>
  );
}

export function Contracts() {
  const [data, setData] = useState<Contract[] | null>(null);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [categories, setCategories] = useState<Categories | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ContractStatus | 'todos'>('todos');
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    Promise.all([api.getContracts(), api.getApartments(), api.getCategories()])
      .then(([contracts, apts, cats]) => {
        setData(contracts.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
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
    return filter === 'todos' ? data : data.filter((c) => c.status === filter);
  }, [data, filter]);

  async function changeStatus(code: string, status: ContractStatus) {
    setBusyCode(code);
    setActionError(null);
    try {
      const updated = await api.setContractStatus(code, status);
      setData((prev) => prev?.map((c) => (c.code === code ? updated : c)) ?? prev);
    } catch (err) {
      setActionError(describeApiError(err));
    } finally {
      setBusyCode(null);
    }
  }

  return (
    <div>
      <PageHeader title="Contratos" subtitle="Arriendos formales de largo plazo, más allá de una reserva corta con HOLD." />
      <div className="space-y-6">
        <CreateContractForm apartments={apartments} categoryLabel={categoryLabel} onCreated={(c) => setData((prev) => (prev ? [c, ...prev] : [c]))} />

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

        <AsyncSection loading={loading} error={error} data={filtered} empty="No hay contratos con este filtro." onRetry={load}>
          {(contracts) => (
            <Card className="divide-y divide-line">
              {contracts.map((c) => (
                <div key={c.code} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-ink">{c.unitLabel}</span>
                      <ContractStatusBadge status={c.status} />
                    </div>
                    <div className="mt-1 text-sm text-ink/80">{c.tenantName}{c.tenantPhone ? ` · ${c.tenantPhone}` : ''}</div>
                    <div className="mt-1 text-xs text-muted">
                      {fmtDate(c.startDate)} → {fmtDate(c.endDate)} · {c.code}
                    </div>
                    {c.notes && <div className="mt-1 text-xs text-ink/70">{c.notes}</div>}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="font-display font-bold text-emerald-dark">{fmtCOP(c.monthlyRent)}/mes</span>
                    {c.status === 'activo' && (
                      <div className="flex gap-2">
                        <Button variant="ghost" disabled={busyCode === c.code} onClick={() => changeStatus(c.code, 'finalizado')}>Finalizar</Button>
                        <Button variant="danger" disabled={busyCode === c.code} onClick={() => changeStatus(c.code, 'cancelado')}>Cancelar</Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </Card>
          )}
        </AsyncSection>
      </div>
    </div>
  );
}
