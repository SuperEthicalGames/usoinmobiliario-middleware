import { useEffect, useState } from 'react';
import type { RecordAction, ReservationRecord } from '../types';
import { api, describeApiError } from '../api';
import { Button, ConfirmDialog, fmtCOP, fmtDate } from './ui';
import { PaymentBadge, StatusBadge, TypeBadge } from './StatusBadge';
import { CloseIcon, ExternalLinkIcon } from './icons';

// Fecha local del navegador (sin zona horaria de negocio, a diferencia de todayIsoBogota en el
// backend) — suficiente para decidir si MOSTRAR el botón deshabilitado; el backend es quien de
// verdad manda y rechaza con checkin-too-early si igual se intentara.
function todayIsoLocal(): string {
  return new Date().toISOString().slice(0, 10);
}

// Reservas y citas comparten la misma máquina de estados (confirm/reject/cancel/complete) —
// mismo criterio que setReservationStatus en el backend, un solo componente para las dos.
const PAYMENT_METHOD_LABELS: Record<string, string> = { bank_transfer: 'Transferencia bancaria', cash: 'Efectivo' };

// paymentReport.proofUrl lo escribe el cliente (o cualquiera que llame a Firebase directo con
// el SDK real, saltándose por completo la UI del sitio) — database.rules.json ya exige
// https:// del lado del servidor para escrituras nuevas, pero un registro viejo (de antes de
// esa regla) o cualquier ruta que la pase por alto igual podría traer un valor tipo
// "javascript:...". React no sanea el esquema de un href por su cuenta: si esto se pusiera
// directo en <a href>, un admin que hiciera clic ejecutaría ese código con la sesión de admin
// ya autenticada (localStorage/memoria con el token de Firebase Auth incluidos). Nunca
// renderizar como link clicable sin este chequeo explícito de esquema.
function isSafeHttpUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https:\/\//i.test(value.trim());
}

const ACTIONS: { key: RecordAction; label: string; hint: string; variant: 'primary' | 'ghost' | 'danger'; when: (r: ReservationRecord) => boolean }[] = [
  { key: 'confirm', label: 'Confirmar', hint: 'Aprueba la reserva/cita — el HOLD deja de importar', variant: 'primary', when: (r) => r.status === 'pendiente' },
  { key: 'reject', label: 'Rechazar', hint: 'La rechaza y libera las fechas/horario para otros clientes', variant: 'danger', when: (r) => r.status === 'pendiente' },
  { key: 'cancel', label: 'Cancelar', hint: 'Cancela una reserva/cita ya en curso y libera las fechas/horario', variant: 'ghost', when: (r) => r.status === 'pendiente' || r.status === 'confirmada' },
  { key: 'complete', label: 'Completar', hint: 'Marca la estadía/visita como ya realizada', variant: 'primary', when: (r) => r.status === 'confirmada' },
];

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === '') return null;
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted">{label}</span>
      <span className="text-right font-bold text-ink">{value}</span>
    </div>
  );
}

type CheckKind = 'check-in' | 'check-out';
type PendingConfirm = { kind: 'action'; action: RecordAction } | { kind: 'check'; check: CheckKind };

export function RecordDetail({ record, onClose, onUpdated }: {
  record: ReservationRecord;
  onClose: () => void;
  onUpdated: (updated: ReservationRecord) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [confirming, setConfirming] = useState<PendingConfirm | null>(null);
  const isVisit = record.type === 'cita';
  const canTrackStay = !isVisit && record.status === 'confirmada';
  const checkinTooEarly = !isVisit && !!record.checkin && todayIsoLocal() < record.checkin;

  useEffect(() => {
    const frame = requestAnimationFrame(() => setShow(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function run(action: RecordAction) {
    setBusy(action);
    setError(null);
    try {
      const updated = await api.runRecordAction(record.code, action);
      onUpdated(updated);
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setBusy(null);
      setConfirming(null);
    }
  }

  async function runCheck(kind: CheckKind) {
    setBusy(kind);
    setError(null);
    try {
      const updated = await (kind === 'check-in' ? api.checkIn(record.code) : api.checkOut(record.code));
      onUpdated(updated);
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setBusy(null);
      setConfirming(null);
    }
  }

  function confirmAndRun() {
    if (!confirming) return;
    if (confirming.kind === 'action') run(confirming.action);
    else runCheck(confirming.check);
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-end bg-graphite-950/50 transition-opacity duration-200 ${show ? 'opacity-100' : 'opacity-0'}`}
      onClick={onClose}
    >
      <div
        className={`h-full w-full max-w-md overflow-y-auto bg-card p-6 shadow-2xl transition-transform duration-200 ease-out ${show ? 'translate-x-0' : 'translate-x-full'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-xl font-semibold text-ink">{record.code}</span>
              <TypeBadge type={record.type} />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <StatusBadge status={record.status} />
              {!isVisit && record.paymentStatus && <PaymentBadge status={record.paymentStatus} />}
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted transition hover:bg-paper-2 hover:text-ink" aria-label="Cerrar">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="divide-y divide-line rounded-xl border border-line px-4">
          <Row label="Creado" value={new Date(record.createdAt).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })} />
          <Row label="Unidad" value={record.unitLabel} />
          <Row label="Nombre" value={record.name} />
          <Row label="Teléfono" value={record.phone} />
          <Row label="Correo" value={record.email} />
          {!isVisit ? (
            <>
              <Row label="Check-in" value={fmtDate(record.checkin)} />
              <Row label="Check-out" value={fmtDate(record.checkout)} />
              <Row label="Noches" value={record.nights} />
              <Row label="Huéspedes" value={record.guests} />
              <Row label="Total estimado" value={fmtCOP(record.estTotal)} />
              {record.priceCheck && !record.priceCheck.matchesReported && (
                <div className="my-1.5 rounded-lg bg-red/10 px-3 py-2 text-xs text-red-dark">
                  ⚠️ El total reportado ({fmtCOP(record.priceCheck.reportedTotal)}) no coincide con el cálculo real según las tarifas vigentes ({fmtCOP(record.priceCheck.expectedTotal)}). El sitio web calcula este monto en el navegador del cliente — verifica el pago contra el monto <strong>calculado</strong>, no contra el reportado, antes de confirmar.
                </div>
              )}
              <Row label="Método de pago" value={record.paymentMethod ? (PAYMENT_METHOD_LABELS[record.paymentMethod] ?? record.paymentMethod) : undefined} />
            </>
          ) : (
            <>
              <Row label="Fecha de visita" value={fmtDate(record.visitDate)} />
              <Row label="Hora" value={record.visitTime} />
              <Row label="Tipo" value={record.appointmentType === 'general_visit' ? 'Visita general' : 'Visita específica'} />
            </>
          )}
          <Row label="Notas" value={record.notes} />
        </div>

        {!isVisit && record.paymentReport && (
          <div className="mt-4 rounded-xl border border-line px-4 py-3">
            <div className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">Comprobante reportado</div>
            <Row label="Banco" value={record.paymentReport.bank} />
            <Row label="Referencia" value={record.paymentReport.reference} />
            <Row label="Monto" value={fmtCOP(record.paymentReport.amount)} />
            <Row label="Fecha" value={fmtDate(record.paymentReport.date)} />
            {isSafeHttpUrl(record.paymentReport.proofUrl) && (
              <a href={record.paymentReport.proofUrl} target="_blank" rel="noopener" className="mt-1 inline-flex items-center gap-1 text-sm font-bold text-gold-dark hover:underline">
                Ver comprobante
                <ExternalLinkIcon className="h-3.5 w-3.5" />
              </a>
            )}
            {record.paymentReport.proofUrl && !isSafeHttpUrl(record.paymentReport.proofUrl) && (
              <p className="mt-1 text-xs text-red-dark">Comprobante con formato de enlace inválido — no se muestra por seguridad.</p>
            )}
          </div>
        )}

        {canTrackStay && (
          <div className="mt-4 rounded-xl border border-line px-4 py-3">
            <div className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">Estadía real</div>
            <Row label="Check-in real" value={record.actualCheckinAt ? new Date(record.actualCheckinAt).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : undefined} />
            <Row label="Check-out real" value={record.actualCheckoutAt ? new Date(record.actualCheckoutAt).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : undefined} />
            {!record.actualCheckinAt && (
              <Button
                className="mt-2"
                disabled={!!busy || checkinTooEarly}
                title={checkinTooEarly ? `Todavía no es el día de check-in (es el ${fmtDate(record.checkin)}).` : undefined}
                onClick={() => setConfirming({ kind: 'check', check: 'check-in' })}
              >
                {busy === 'check-in' ? '...' : 'Registrar check-in'}
              </Button>
            )}
            {checkinTooEarly && !record.actualCheckinAt && (
              <p className="mt-1.5 text-xs text-muted">Disponible a partir del {fmtDate(record.checkin)}.</p>
            )}
            {record.actualCheckinAt && !record.actualCheckoutAt && (
              <Button className="mt-2" disabled={!!busy} onClick={() => setConfirming({ kind: 'check', check: 'check-out' })}>
                {busy === 'check-out' ? '...' : 'Registrar check-out'}
              </Button>
            )}
            {record.actualCheckinAt && record.actualCheckoutAt && (
              <p className="mt-1 text-xs text-muted">Estadía completa — el check-out ya programó el aseo de salida.</p>
            )}
          </div>
        )}

        {error && <p className="mt-4 rounded-xl bg-red/10 px-3.5 py-2.5 text-sm text-red-dark">{error}</p>}

        <div className="mt-6 flex flex-wrap gap-2">
          {ACTIONS.filter((a) => a.when(record)).map((a) => (
            <Button key={a.key} variant={a.variant} disabled={!!busy} onClick={() => setConfirming({ kind: 'action', action: a.key })} title={a.hint}>
              {busy === a.key ? '...' : a.label}
            </Button>
          ))}
        </div>
      </div>

      {confirming && (
        <ConfirmDialog
          title={confirming.kind === 'check'
            ? (confirming.check === 'check-in' ? 'Registrar check-in' : 'Registrar check-out')
            : `¿${ACTIONS.find((a) => a.key === confirming.action)?.label} esta ${isVisit ? 'cita' : 'reserva'}?`}
          description={confirming.kind === 'check'
            ? (confirming.check === 'check-in'
                ? 'Marca la unidad como en uso ahora mismo — se refleja de inmediato en el catálogo público.'
                : 'Marca la estadía como terminada y programa el aseo de salida automáticamente.')
            : ACTIONS.find((a) => a.key === confirming.action)?.hint}
          tone={confirming.kind === 'action' && confirming.action === 'reject' ? 'danger' : 'primary'}
          busy={!!busy}
          confirmLabel="Sí, continuar"
          onCancel={() => setConfirming(null)}
          onConfirm={confirmAndRun}
        />
      )}
    </div>
  );
}
