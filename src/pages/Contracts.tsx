import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, describeApiError } from '../api';
import type { Apartment, Categories, Contract, ContractStatus, PaymentTerm } from '../types';
import { AsyncSection, Button, Card, Field, PageHeader, Select, TextArea, fmtCOP, fmtDate } from '../components/ui';
import { ContractStatusBadge } from '../components/StatusBadge';
import { RegisterPaymentPanel } from '../components/RegisterPaymentPanel';

const STATUS_FILTERS: { key: ContractStatus | 'todos'; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'activo', label: 'Activos' },
  { key: 'finalizado', label: 'Finalizados' },
  { key: 'cancelado', label: 'Cancelados' },
];
const TERM_OPTIONS: { value: PaymentTerm; label: string }[] = [
  { value: 'mensual', label: 'Mensual' },
  { value: 'quincenal', label: 'Quincenal (15 días)' },
  { value: 'semanal', label: 'Semanal (mínimo permitido)' },
];
const TERM_LABELS: Record<PaymentTerm, string> = { mensual: 'Mensual', quincenal: 'Quincenal', semanal: 'Semanal' };

interface TenantForm { name: string; documentId: string; phone: string; email: string; }
function emptyTenant(): TenantForm { return { name: '', documentId: '', phone: '', email: '' }; }

function CreateContractForm({ apartments, categoryLabel, onCreated }: {
  apartments: Apartment[]; categoryLabel: (t: string) => string; onCreated: (c: Contract) => void;
}) {
  const [selectedKey, setSelectedKey] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [maxOccupancy, setMaxOccupancy] = useState('1');
  const [tenants, setTenants] = useState<TenantForm[]>([emptyTenant()]);
  const [hasJointDebtor, setHasJointDebtor] = useState(false);
  const [jointDebtorName, setJointDebtorName] = useState('');
  const [jointDebtorDoc, setJointDebtorDoc] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [paymentTerm, setPaymentTerm] = useState<PaymentTerm>('mensual');
  const [monthlyRent, setMonthlyRent] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = apartments.find((a) => a._key === selectedKey);

  function setTenant(i: number, patch: Partial<TenantForm>) {
    setTenants((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }
  function addTenant() { setTenants((prev) => [...prev, emptyTenant()]); }
  function removeTenant(i: number) { setTenants((prev) => prev.filter((_, idx) => idx !== i)); }

  function reset() {
    setSelectedKey(''); setRoomCode(''); setMaxOccupancy('1'); setTenants([emptyTenant()]);
    setHasJointDebtor(false); setJointDebtorName(''); setJointDebtorDoc('');
    setStartDate(''); setEndDate(''); setPaymentTerm('mensual');
    setMonthlyRent(''); setDepositAmount(''); setNotes('');
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.createContract({
        unitType: selected.typeKey, unitNum: selected.num, unitLabel: `Apartamento H${selected.num}`,
        roomCode, maxOccupancy: Number(maxOccupancy) || 1,
        tenants: tenants.filter((t) => t.name.trim() || t.documentId.trim())
          .map((t) => ({ name: t.name.trim(), documentId: t.documentId.trim(), phone: t.phone.trim() || undefined, email: t.email.trim() || undefined })),
        jointDebtor: hasJointDebtor && jointDebtorName.trim() ? { name: jointDebtorName.trim(), documentId: jointDebtorDoc.trim() } : undefined,
        startDate, endDate, paymentTerm,
        monthlyRent: Number(monthlyRent), depositAmount: Number(depositAmount) || 0,
        notes: notes || undefined,
      });
      onCreated(created);
      reset();
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
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Select label="Apartamento" required value={selectedKey} onChange={(e) => setSelectedKey(e.target.value)} className="sm:col-span-2">
            <option value="">Selecciona un apartamento...</option>
            {apartments.map((a) => (
              <option key={a._key} value={a._key}>Apartamento H{a.num} — {categoryLabel(a.typeKey)}</option>
            ))}
          </Select>
          <Field label="Código de habitación" placeholder="ej. 210H06" value={roomCode} onChange={(e) => setRoomCode(e.target.value)} />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-muted">Arrendatarios solidarios</span>
            <Button type="button" variant="ghost" onClick={addTenant} className="px-3 py-1.5 text-xs">+ Agregar otro</Button>
          </div>
          <div className="space-y-3">
            {tenants.map((t, i) => (
              <div key={i} className="rounded-xl border border-line p-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Nombre" required={i === 0} value={t.name} onChange={(e) => setTenant(i, { name: e.target.value })} />
                  <Field label="Cédula / documento" required={i === 0} value={t.documentId} onChange={(e) => setTenant(i, { documentId: e.target.value })} />
                  <Field label="Teléfono (opcional)" value={t.phone} onChange={(e) => setTenant(i, { phone: e.target.value })} />
                  <Field label="Correo (opcional)" type="email" value={t.email} onChange={(e) => setTenant(i, { email: e.target.value })} />
                </div>
                {tenants.length > 1 && (
                  <button type="button" onClick={() => removeTenant(i)} className="mt-2 text-xs font-bold text-red-dark hover:underline">
                    Quitar arrendatario
                  </button>
                )}
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted">El correo del primer arrendatario que lo tenga es a quien se le envían los recibos de abono.</p>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={hasJointDebtor} onChange={(e) => setHasJointDebtor(e.target.checked)} className="h-4 w-4" />
            Tiene deudor solidario
          </label>
          {hasJointDebtor && (
            <div className="mt-3 grid grid-cols-1 gap-3 rounded-xl border border-line p-3 sm:grid-cols-2">
              <Field label="Nombre del deudor solidario" value={jointDebtorName} onChange={(e) => setJointDebtorName(e.target.value)} />
              <Field label="Cédula / documento" value={jointDebtorDoc} onChange={(e) => setJointDebtorDoc(e.target.value)} />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Fecha de inicio" type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Field label="Fecha de fin" type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <Field label="Ocupación máxima" type="number" min={1} value={maxOccupancy} onChange={(e) => setMaxOccupancy(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Canon mensual (COP)" type="number" min={1} required value={monthlyRent} onChange={(e) => setMonthlyRent(e.target.value)} />
          <Field label="Depósito (COP, opcional)" type="number" min={0} value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} />
          <Select label="Término de pago" value={paymentTerm} onChange={(e) => setPaymentTerm(e.target.value as PaymentTerm)}>
            {TERM_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </div>
        <TextArea label="Notas (opcional)" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        {error && <p className="rounded-xl bg-red/10 px-3.5 py-2.5 text-sm text-red-dark">{error}</p>}
        <Button type="submit" disabled={submitting || !selected}>{submitting ? 'Creando...' : 'Crear contrato'}</Button>
      </form>
    </Card>
  );
}

function PaymentHistory({ contract, onDownload, downloadingReceipt }: {
  contract: Contract; onDownload: (receiptNumber: number) => void; downloadingReceipt: number | null;
}) {
  const payments = [...contract.payments].sort((a, b) => b.receiptNumber - a.receiptNumber);
  if (payments.length === 0) return <p className="p-4 text-sm text-muted">Todavía no hay abonos registrados en este contrato.</p>;
  return (
    <div className="divide-y divide-line">
      {payments.map((p) => {
        const total = p.lines.reduce((s, l) => s + l.amount, 0);
        return (
          <div key={p.receiptNumber} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-sm font-bold text-ink">Recibo N.° {p.receiptNumber} · {fmtDate(p.date)}</div>
              <div className="text-xs text-muted">{fmtDate(p.periodStart)} → {fmtDate(p.periodEnd)}</div>
              <div className="mt-1 text-xs text-ink/70">
                {p.lines.map((l, i) => (
                  <span key={i}>
                    {i > 0 && ' · '}
                    {l.method === 'transferencia' ? 'Transferencia' : l.method === 'efectivo' ? 'Efectivo' : (l.description || 'Otro')} {fmtCOP(l.amount)}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <div className="text-right text-sm">
                <div className="font-bold text-emerald-dark">{fmtCOP(total)}</div>
                <div className="text-xs text-muted">Saldo: {fmtCOP(p.balanceAfter)}</div>
              </div>
              <Button variant="ghost" disabled={downloadingReceipt === p.receiptNumber} onClick={() => onDownload(p.receiptNumber)} className="px-3 py-1.5 text-xs">
                {downloadingReceipt === p.receiptNumber ? '...' : 'Descargar PDF'}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
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
  const [expanded, setExpanded] = useState<string | null>(null);
  const [registeringFor, setRegisteringFor] = useState<Contract | null>(null);
  const [downloadingReceipt, setDownloadingReceipt] = useState<number | null>(null);

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

  function handlePaymentSaved(updated: Contract) {
    setData((prev) => prev?.map((c) => (c.code === updated.code ? updated : c)) ?? prev);
    setRegisteringFor(updated);
  }

  async function handleDownload(code: string, receiptNumber: number) {
    setDownloadingReceipt(receiptNumber);
    setActionError(null);
    try {
      await api.downloadContractReceipt(code, receiptNumber);
    } catch (err) {
      setActionError(describeApiError(err));
    } finally {
      setDownloadingReceipt(null);
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
            <div className="space-y-4">
              {contracts.map((c) => (
                <Card key={c.code} className="overflow-hidden">
                  <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-ink">{c.unitLabel}{c.roomCode ? ` · ${c.roomCode}` : ''}</span>
                        <ContractStatusBadge status={c.status} />
                      </div>
                      <div className="mt-1 text-sm text-ink/80">
                        {(c.tenants ?? []).map((t) => t.name).join(', ') || 'Sin arrendatarios registrados'}
                        {c.jointDebtor?.name ? ` · Deudor solidario: ${c.jointDebtor.name}` : ''}
                      </div>
                      <div className="mt-1 text-xs text-muted">
                        {fmtDate(c.startDate)} → {fmtDate(c.endDate)} · {c.code} · {TERM_LABELS[c.paymentTerm] ?? c.paymentTerm} · ocupación máx. {c.maxOccupancy}
                      </div>
                      {c.notes && <div className="mt-1 text-xs text-ink/70">{c.notes}</div>}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span className="font-display font-bold text-emerald-dark">{fmtCOP(c.monthlyRent)}/mes</span>
                      <div className="flex flex-wrap justify-end gap-2">
                        {c.status === 'activo' && (
                          <Button disabled={busyCode === c.code} onClick={() => setRegisteringFor(c)} className="px-3 py-1.5 text-xs">
                            Registrar abono
                          </Button>
                        )}
                        <Button variant="ghost" onClick={() => setExpanded((prev) => (prev === c.code ? null : c.code))} className="px-3 py-1.5 text-xs">
                          {expanded === c.code ? 'Ocultar abonos' : `Ver abonos (${c.payments.length})`}
                        </Button>
                        {c.status === 'activo' && (
                          <>
                            <Button variant="ghost" disabled={busyCode === c.code} onClick={() => changeStatus(c.code, 'finalizado')} className="px-3 py-1.5 text-xs">Finalizar</Button>
                            <Button variant="danger" disabled={busyCode === c.code} onClick={() => changeStatus(c.code, 'cancelado')} className="px-3 py-1.5 text-xs">Cancelar</Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  {expanded === c.code && (
                    <div className="border-t border-line bg-paper-2">
                      <PaymentHistory contract={c} onDownload={(receiptNumber) => handleDownload(c.code, receiptNumber)} downloadingReceipt={downloadingReceipt} />
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </AsyncSection>
      </div>

      {registeringFor && (
        <RegisterPaymentPanel
          contract={registeringFor}
          onClose={() => setRegisteringFor(null)}
          onSaved={handlePaymentSaved}
        />
      )}
    </div>
  );
}
