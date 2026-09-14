import { useEffect, useState } from 'react';
import type { Contract, ContractPayment, ContractPaymentMethod } from '../types';
import { api, describeApiError } from '../api';
import { Button, Field, Select, fmtCOP, fmtDate } from './ui';
import { CloseIcon } from './icons';

const METHOD_OPTIONS: { value: ContractPaymentMethod; label: string }[] = [
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'otro', label: 'Otro concepto (ej. comisión de referidos, acuerdo no monetario)' },
];

interface LineForm { method: ContractPaymentMethod; amount: string; description: string; }
function emptyLine(): LineForm { return { method: 'transferencia', amount: '', description: '' }; }

function todayIsoLocal(): string {
  return new Date().toISOString().slice(0, 10);
}

// Panel deslizante para registrar un abono — mismo lenguaje visual que ApartmentEditor/
// RecordDetail. Un abono es un ARRAY de líneas (mismo patrón que la factura real: transferencia
// + efectivo dentro de un solo abono), así que el formulario deja agregar/quitar líneas en vez
// de fijar dos campos de monto como antes.
export function RegisterPaymentPanel({ contract, onClose, onSaved }: {
  contract: Contract;
  onClose: () => void;
  onSaved: (updated: Contract) => void;
}) {
  const [date, setDate] = useState(todayIsoLocal());
  const [lines, setLines] = useState<LineForm[]>([emptyLine()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ payment: ContractPayment; emailSent: boolean } | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setShow(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function setLine(i: number, patch: Partial<LineForm>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLine() { setLines((prev) => [...prev, emptyLine()]); }
  function removeLine(i: number) { setLines((prev) => prev.filter((_, idx) => idx !== i)); }

  const lastPayment = [...contract.payments].sort((a, b) => b.receiptNumber - a.receiptNumber)[0];
  const total = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);

  async function onSubmit() {
    const cleanLines = lines
      .map((l) => ({ method: l.method, amount: Number(l.amount) || 0, description: l.description.trim() || undefined }))
      .filter((l) => l.amount > 0 || l.description);
    if (cleanLines.length === 0) { setError('Agrega al menos una línea con un monto o una descripción.'); return; }
    setSubmitting(true);
    setError(null);
    try {
      const { contract: updated, payment, emailSent } = await api.addContractPayment(contract.code, { lines: cleanLines, date });
      onSaved(updated);
      setResult({ payment, emailSent });
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-end bg-graphite-950/50 transition-opacity duration-200 ${show ? 'opacity-100' : 'opacity-0'}`}
      onClick={onClose}
    >
      <div
        className={`h-full w-full max-w-lg overflow-y-auto bg-card p-6 shadow-2xl transition-transform duration-200 ease-out ${show ? 'translate-x-0' : 'translate-x-full'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <div className="font-display text-xl font-semibold text-ink">Registrar abono</div>
            <div className="mt-1 text-xs text-muted">Contrato {contract.code} · {contract.unitLabel}</div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted transition hover:bg-paper-2 hover:text-ink" aria-label="Cerrar">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {result ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-emerald/10 px-4 py-3.5 text-sm text-emerald-dark">
              Abono registrado — recibo N.° {result.payment.receiptNumber}.
            </div>
            <div className="rounded-xl border border-line p-4 text-sm">
              <div className="flex justify-between py-1"><span className="text-muted">Período</span><span className="font-bold text-ink">{fmtDate(result.payment.periodStart)} → {fmtDate(result.payment.periodEnd)}</span></div>
              <div className="flex justify-between py-1"><span className="text-muted">Total abono</span><span className="font-bold text-ink">{fmtCOP(result.payment.lines.reduce((s, l) => s + l.amount, 0))}</span></div>
              <div className="flex justify-between py-1"><span className="text-muted">Saldo pendiente del período</span><span className="font-bold text-gold-dark">{fmtCOP(result.payment.balanceAfter)}</span></div>
            </div>
            <p className="text-xs text-muted">
              {result.emailSent
                ? 'Correo con el recibo en PDF enviado al arrendatario.'
                : 'No se pudo enviar el correo (revisa que el arrendatario tenga correo registrado) — el abono ya quedó guardado igual.'}
            </p>
            <div className="flex justify-end gap-2 border-t border-line pt-4">
              <Button onClick={onClose}>Cerrar</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {lastPayment && (
              <div className="rounded-xl bg-paper-2 px-3.5 py-2.5 text-xs text-ink/70">
                Último abono: recibo N.° {lastPayment.receiptNumber} el {fmtDate(lastPayment.date)} — saldo pendiente quedó en {fmtCOP(lastPayment.balanceAfter)} ({fmtDate(lastPayment.periodStart)} → {fmtDate(lastPayment.periodEnd)}).
              </div>
            )}
            <Field label="Fecha del abono" type="date" value={date} onChange={(e) => setDate(e.target.value)} />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-muted">Líneas del abono</span>
                <Button type="button" variant="ghost" onClick={addLine} className="px-3 py-1.5 text-xs">+ Agregar línea</Button>
              </div>
              {lines.map((line, i) => (
                <div key={i} className="rounded-xl border border-line p-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Select label="Método" value={line.method} onChange={(e) => setLine(i, { method: e.target.value as ContractPaymentMethod })}>
                      {METHOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </Select>
                    <Field label="Monto (COP)" type="number" min={0} value={line.amount} onChange={(e) => setLine(i, { amount: e.target.value })} />
                  </div>
                  <Field
                    label={line.method === 'otro' ? 'Descripción (requerida — ej. comisión de referidos, algo vendido a cambio de arriendo)' : 'Descripción (opcional)'}
                    className="mt-3"
                    value={line.description}
                    onChange={(e) => setLine(i, { description: e.target.value })}
                  />
                  {lines.length > 1 && (
                    <button type="button" onClick={() => removeLine(i)} className="mt-2 text-xs font-bold text-red-dark hover:underline">
                      Quitar línea
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-between border-t border-line pt-3 text-sm">
              <span className="font-bold text-ink">Total del abono</span>
              <span className="font-display font-bold text-emerald-dark">{fmtCOP(total)}</span>
            </div>

            {error && <p className="rounded-xl bg-red/10 px-3.5 py-2.5 text-sm text-red-dark">{error}</p>}

            <div className="flex justify-end gap-2 border-t border-line pt-4">
              <Button variant="ghost" onClick={onClose}>Cancelar</Button>
              <Button disabled={submitting} onClick={onSubmit}>{submitting ? 'Registrando...' : 'Registrar abono'}</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
