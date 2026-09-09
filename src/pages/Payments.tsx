import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api';
import type { ReservationRecord } from '../types';
import { AsyncSection, Card, PageHeader, Button, fmtCOP, fmtDate } from '../components/ui';

// Mismo criterio de filtrado que PaymentService.GetPendingVerificationAsync/GetPendingCashAsync
// en Unity: traer TODAS las reservas (ya lo hace /admin/api/reservations) y derivar las dos
// listas acá, en vez de inventar dos endpoints nuevos solo para esto.
function isPendingVerification(r: ReservationRecord) { return r.type === 'reserva' && r.paymentStatus === 'submitted'; }
function isPendingCash(r: ReservationRecord) { return r.type === 'reserva' && r.paymentMethod === 'cash' && r.paymentStatus === 'none'; }

function ActionRow({ r, busyCode, onVerify, onReject, onCash }: {
  r: ReservationRecord;
  busyCode: string | null;
  onVerify?: (code: string) => void;
  onReject?: (code: string) => void;
  onCash?: (code: string) => void;
}) {
  const busy = busyCode === r.code;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
      <div>
        <div className="font-bold text-ink">{r.code} · {r.unitLabel}</div>
        <div className="text-xs text-ink/50">{r.name} · {fmtDate(r.checkin)} → {fmtDate(r.checkout)}</div>
        {r.paymentReport && (
          <div className="mt-1 text-xs text-ink/70">
            {r.paymentReport.bank} · ref. {r.paymentReport.reference} · {fmtCOP(r.paymentReport.amount)} · {fmtDate(r.paymentReport.date)}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="font-bold text-forest">{fmtCOP(r.estTotal)}</span>
        <div className="flex gap-2">
          {onVerify && <Button disabled={busy} onClick={() => onVerify(r.code)}>{busy ? '...' : 'Verificar'}</Button>}
          {onReject && <Button variant="danger" disabled={busy} onClick={() => onReject(r.code)}>{busy ? '...' : 'Rechazar'}</Button>}
          {onCash && <Button disabled={busy} onClick={() => onCash(r.code)}>{busy ? '...' : 'Registrar recibido'}</Button>}
        </div>
      </div>
    </div>
  );
}

export function Payments() {
  const [data, setData] = useState<ReservationRecord[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    api.getReservations()
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? `No se pudieron cargar los pagos (${err.code}).` : 'No se pudieron cargar los pagos.'))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  const pendingVerification = useMemo(() => data?.filter(isPendingVerification) ?? [], [data]);
  const pendingCash = useMemo(() => data?.filter(isPendingCash) ?? [], [data]);

  async function handle(code: string, action: 'verify' | 'reject' | 'cash') {
    setBusyCode(code);
    setActionError(null);
    try {
      const fn = action === 'verify' ? api.verifyPayment : action === 'reject' ? api.rejectPayment : api.registerCashPayment;
      const updated = await fn(code);
      setData((prev) => prev?.map((r) => (r.code === code ? updated : r)) ?? prev);
    } catch (err) {
      setActionError(err instanceof ApiError ? `No se pudo procesar (${err.code}).` : 'Ocurrió un error.');
    } finally {
      setBusyCode(null);
    }
  }

  return (
    <div>
      <PageHeader title="Pagos" subtitle="Verificación manual — el cliente nunca confirma su propio pago." />
      {actionError && <p className="mb-4 text-sm text-clay">{actionError}</p>}
      <AsyncSection loading={loading} error={error} data={data} onRetry={load}>
        {() => (
          <div className="space-y-8">
            <div>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink/50">
                Transferencias por verificar ({pendingVerification.length})
              </h2>
              <Card className="divide-y divide-line">
                {pendingVerification.length === 0 && <p className="p-5 text-sm text-ink/50">No hay transferencias pendientes.</p>}
                {pendingVerification.map((r) => (
                  <ActionRow key={r.code} r={r} busyCode={busyCode}
                    onVerify={(c) => handle(c, 'verify')} onReject={(c) => handle(c, 'reject')} />
                ))}
              </Card>
            </div>
            <div>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink/50">
                Efectivo por registrar ({pendingCash.length})
              </h2>
              <Card className="divide-y divide-line">
                {pendingCash.length === 0 && <p className="p-5 text-sm text-ink/50">No hay pagos en efectivo pendientes.</p>}
                {pendingCash.map((r) => (
                  <ActionRow key={r.code} r={r} busyCode={busyCode} onCash={(c) => handle(c, 'cash')} />
                ))}
              </Card>
            </div>
          </div>
        )}
      </AsyncSection>
    </div>
  );
}
