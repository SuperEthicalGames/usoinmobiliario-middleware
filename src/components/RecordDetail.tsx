import { useEffect, useState } from 'react';
import type { RecordAction, ReservationRecord } from '../types';
import { api, describeApiError } from '../api';
import { Button, fmtCOP, fmtDate } from './ui';
import { PaymentBadge, StatusBadge, TypeBadge } from './StatusBadge';

// Reservas y citas comparten la misma máquina de estados (confirm/reject/cancel/complete) —
// mismo criterio que setReservationStatus en el backend, un solo componente para las dos.
const PAYMENT_METHOD_LABELS: Record<string, string> = { bank_transfer: 'Transferencia bancaria', cash: 'Efectivo' };

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
      <span className="text-ink/50">{label}</span>
      <span className="text-right font-bold text-ink">{value}</span>
    </div>
  );
}

export function RecordDetail({ record, onClose, onUpdated }: {
  record: ReservationRecord;
  onClose: () => void;
  onUpdated: (updated: ReservationRecord) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isVisit = record.type === 'cita';

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
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40" onClick={onClose}>
      <div className="h-full w-full max-w-md overflow-y-auto bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-xl font-semibold text-ink">{record.code}</span>
              <TypeBadge type={record.type} />
            </div>
            <div className="mt-1 flex gap-2">
              <StatusBadge status={record.status} />
              {!isVisit && record.paymentStatus && <PaymentBadge status={record.paymentStatus} />}
            </div>
          </div>
          <button onClick={onClose} className="text-xl text-ink/50 hover:text-ink" aria-label="Cerrar">✕</button>
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
            <div className="mb-1 text-xs font-bold uppercase tracking-wide text-ink/50">Comprobante reportado</div>
            <Row label="Banco" value={record.paymentReport.bank} />
            <Row label="Referencia" value={record.paymentReport.reference} />
            <Row label="Monto" value={fmtCOP(record.paymentReport.amount)} />
            <Row label="Fecha" value={fmtDate(record.paymentReport.date)} />
            {record.paymentReport.proofUrl && (
              <a href={record.paymentReport.proofUrl} target="_blank" rel="noopener" className="text-sm font-bold text-forest underline">
                Ver comprobante
              </a>
            )}
          </div>
        )}

        {error && <p className="mt-4 text-sm text-clay">{error}</p>}

        <div className="mt-6 flex flex-wrap gap-2">
          {ACTIONS.filter((a) => a.when(record)).map((a) => (
            <Button key={a.key} variant={a.variant} disabled={!!busy} onClick={() => run(a.key)} title={a.hint}>
              {busy === a.key ? '...' : a.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
