import { useEffect, useMemo, useState } from 'react';
import { api, describeApiError } from '../api';
import type { ReservationRecord } from '../types';
import { AsyncSection, Card, ConfirmDialog, PageHeader, Button, Select, fmtCOP, fmtDate } from '../components/ui';
import { ChartCard, StatTile, TrendChart } from '../components/charts';
import { monthKey, monthLabel, revenueByMonth, todayIsoBogota } from '../lib/analytics';
import { downloadPaymentsReportPdf } from '../lib/paymentsPdf';

// Mismo criterio de filtrado que PaymentService.GetPendingVerificationAsync/GetPendingCashAsync
// en Unity: traer TODAS las reservas (ya lo hace /admin/api/reservations) y derivar las dos
// listas acá, en vez de inventar dos endpoints nuevos solo para esto.
// isActive: el backend nunca limpia paymentStatus al rechazar/cancelar una reserva — sin este
// chequeo, una reserva ya muerta con un pago reportado antes de morir se quedaba apareciendo
// para siempre acá (bug real encontrado en auditoría; el backend ahora también rechaza
// verificar/rechazar pago sobre una reserva rechazada/cancelada, pero el filtro tiene que
// coincidir para no mostrarla como si todavía necesitara acción).
function isActive(r: ReservationRecord) { return r.status !== 'rechazada' && r.status !== 'cancelada'; }
function isPendingVerification(r: ReservationRecord) { return r.type === 'reserva' && r.paymentStatus === 'submitted' && isActive(r); }
function isPendingCash(r: ReservationRecord) { return r.type === 'reserva' && r.paymentMethod === 'cash' && r.paymentStatus === 'none' && isActive(r); }
// Plata ya recibida de verdad (sección 4 del pedido nuevo: "no se ve información de los pagos
// que se han recibido como tal") — el resto de esta pantalla es solo la cola de pendientes.
function isReceived(r: ReservationRecord) { return r.type === 'reserva' && r.paymentStatus === 'verified'; }
// El efectivo nunca trae paymentReport (ver registerCashPayment en firebase.js) — sin una
// marca de tiempo propia de "cuándo se verificó", el check-in es la mejor fecha real disponible
// para ubicar el pago en el tiempo (createdAt como último recurso si ni eso hay).
function receivedDateOf(r: ReservationRecord): string { return r.paymentReport?.date ?? r.checkin ?? r.createdAt; }
function receivedAmountOf(r: ReservationRecord): number { return r.paymentReport?.amount ?? r.estTotal ?? 0; }
function receivedMethodLabel(r: ReservationRecord): string { return r.paymentReport ? 'Transferencia' : r.paymentMethod === 'cash' ? 'Efectivo' : '—'; }

type Action = 'verify' | 'reject' | 'cash';
interface PendingConfirm { r: ReservationRecord; action: Action; }

function ActionRow({ r, busyCode, onVerify, onReject, onCash }: {
  r: ReservationRecord;
  busyCode: string | null;
  onVerify?: (r: ReservationRecord) => void;
  onReject?: (r: ReservationRecord) => void;
  onCash?: (r: ReservationRecord) => void;
}) {
  const busy = busyCode === r.code;
  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="font-bold text-ink">{r.code} · {r.unitLabel}</div>
        <div className="text-xs text-muted">{r.name} · {fmtDate(r.checkin)} → {fmtDate(r.checkout)}</div>
        {r.paymentReport && (
          <div className="mt-1 text-xs text-ink/70">
            {r.paymentReport.bank} · ref. {r.paymentReport.reference} · {fmtCOP(r.paymentReport.amount)} · {fmtDate(r.paymentReport.date)}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
        <div className="text-right">
          <span className="font-display font-bold text-emerald-dark">{fmtCOP(r.estTotal)}</span>
          {r.priceCheck && !r.priceCheck.matchesReported && (
            <div className="text-[11px] font-bold text-red-dark" title={`Cálculo real según tarifas vigentes: ${fmtCOP(r.priceCheck.expectedTotal)}`}>
              ⚠️ no coincide con la tarifa real ({fmtCOP(r.priceCheck.expectedTotal)})
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {onVerify && <Button disabled={busy} onClick={() => onVerify(r)}>{busy ? '...' : 'Verificar'}</Button>}
          {onReject && <Button variant="danger" disabled={busy} onClick={() => onReject(r)}>{busy ? '...' : 'Rechazar'}</Button>}
          {onCash && <Button disabled={busy} onClick={() => onCash(r)}>{busy ? '...' : 'Registrar recibido'}</Button>}
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
  const [confirming, setConfirming] = useState<PendingConfirm | null>(null);
  const [monthFilter, setMonthFilter] = useState<'todos' | string>('todos');

  function load() {
    setLoading(true);
    setError(null);
    api.getReservations()
      .then(setData)
      .catch((err) => setError(describeApiError(err)))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  const pendingVerification = useMemo(() => data?.filter(isPendingVerification) ?? [], [data]);
  const pendingCash = useMemo(() => data?.filter(isPendingCash) ?? [], [data]);

  // Mismos cálculos que Analíticas (lib/analytics.ts), reusados acá para que un cobrador/dueño
  // no tenga que ir a otra pantalla para ver cuánta plata ha entrado — mismos números, deben
  // coincidir exactos para el mismo mes.
  const revenue = useMemo(() => revenueByMonth(data ?? [], '6m'), [data]);
  const currentMonthKey = useMemo(() => monthKey(todayIsoBogota()), []);
  const currentMonthPoint = revenue.find((p) => p.key === currentMonthKey) ?? revenue[revenue.length - 1];

  const received = useMemo(
    () => (data?.filter(isReceived) ?? []).sort((a, b) => receivedDateOf(b).localeCompare(receivedDateOf(a))),
    [data],
  );
  const receivedMonths = useMemo(() => [...new Set(received.map((r) => monthKey(receivedDateOf(r))))].sort().reverse(), [received]);
  const filteredReceived = useMemo(
    () => (monthFilter === 'todos' ? received : received.filter((r) => monthKey(receivedDateOf(r)) === monthFilter)),
    [received, monthFilter],
  );
  const scopeLabel = monthFilter === 'todos' ? 'Todos los meses' : monthLabel(monthFilter);

  async function commit() {
    if (!confirming) return;
    const { r, action } = confirming;
    setBusyCode(r.code);
    setActionError(null);
    try {
      const fn = action === 'verify' ? api.verifyPayment : action === 'reject' ? api.rejectPayment : api.registerCashPayment;
      const updated = await fn(r.code);
      setData((prev) => prev?.map((x) => (x.code === r.code ? updated : x)) ?? prev);
      setConfirming(null);
    } catch (err) {
      setActionError(describeApiError(err));
      setConfirming(null);
    } finally {
      setBusyCode(null);
    }
  }

  return (
    <div>
      <PageHeader title="Pagos" subtitle="Verificación manual — el cliente nunca confirma su propio pago." />
      <p className="mb-4 text-xs text-muted">
        Verificar/Registrar solo marca el PAGO como en orden — la reserva sigue en "pendiente" hasta que la confirmes aparte desde Reservas.
      </p>
      {actionError && <p className="mb-4 rounded-xl bg-red/10 px-3.5 py-2.5 text-sm text-red-dark">{actionError}</p>}
      <AsyncSection loading={loading} error={error} data={data} onRetry={load}>
        {() => (
          <div className="space-y-8">
            <div>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Resumen de ingresos</h2>
              <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatTile
                  label="Verificado este mes"
                  value={fmtCOP(currentMonthPoint?.verified ?? 0)}
                  hint={monthLabel(currentMonthKey)}
                  trend={revenue.map((p) => p.verified)}
                  trendColor="var(--color-emerald)"
                />
                <StatTile
                  label="Por verificar este mes"
                  value={fmtCOP(currentMonthPoint?.pending ?? 0)}
                  hint="Reportado, esperando verificación"
                  trend={revenue.map((p) => p.pending)}
                  trendColor="var(--color-amber)"
                />
                <StatTile label="Transferencias por verificar" value={String(pendingVerification.length)} hint="Ver abajo" />
                <StatTile label="Efectivo por registrar" value={String(pendingCash.length)} hint="Ver abajo" />
              </div>
              <ChartCard title="Ingresos verificados por mes" subtitle="Últimos 6 meses, atribuidos al mes de check-in">
                <TrendChart points={revenue.map((p) => ({ key: p.key, label: p.label, value: p.verified }))} formatValue={fmtCOP} color="var(--color-emerald)" />
              </ChartCard>
            </div>

            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Pagos recibidos ({filteredReceived.length})</h2>
                <div className="flex flex-wrap items-center gap-3">
                  <Select label="Mes" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} className="w-44">
                    <option value="todos">Todos los meses</option>
                    {receivedMonths.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
                  </Select>
                  <Button variant="ghost" onClick={() => downloadPaymentsReportPdf(revenue, filteredReceived, scopeLabel)}>
                    Descargar reporte PDF
                  </Button>
                </div>
              </div>
              <Card className="overflow-hidden">
                {filteredReceived.length === 0 ? (
                  <p className="p-5 text-sm text-muted">No hay pagos recibidos con este filtro.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                          <th className="px-4 py-3">Código</th>
                          <th className="px-4 py-3">Unidad</th>
                          <th className="px-4 py-3">Cliente</th>
                          <th className="px-4 py-3">Método</th>
                          <th className="px-4 py-3">Monto</th>
                          <th className="px-4 py-3">Fecha</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredReceived.map((r) => (
                          <tr key={r.code} className="border-b border-line last:border-0">
                            <td className="px-4 py-3 font-bold text-ink">{r.code}</td>
                            <td className="px-4 py-3">{r.unitLabel}</td>
                            <td className="px-4 py-3 text-ink/70">{r.name}</td>
                            <td className="px-4 py-3 text-ink/70">{receivedMethodLabel(r)}</td>
                            <td className="px-4 py-3 font-bold text-emerald-dark">{fmtCOP(receivedAmountOf(r))}</td>
                            <td className="px-4 py-3 text-ink/70">{fmtDate(receivedDateOf(r))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>

            <div>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
                Transferencias por verificar ({pendingVerification.length})
              </h2>
              <Card className="divide-y divide-line">
                {pendingVerification.length === 0 && <p className="p-5 text-sm text-muted">No hay transferencias pendientes.</p>}
                {pendingVerification.map((r) => (
                  <ActionRow key={r.code} r={r} busyCode={busyCode}
                    onVerify={(rec) => setConfirming({ r: rec, action: 'verify' })}
                    onReject={(rec) => setConfirming({ r: rec, action: 'reject' })} />
                ))}
              </Card>
            </div>
            <div>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
                Efectivo por registrar ({pendingCash.length})
              </h2>
              <Card className="divide-y divide-line">
                {pendingCash.length === 0 && <p className="p-5 text-sm text-muted">No hay pagos en efectivo pendientes.</p>}
                {pendingCash.map((r) => (
                  <ActionRow key={r.code} r={r} busyCode={busyCode} onCash={(rec) => setConfirming({ r: rec, action: 'cash' })} />
                ))}
              </Card>
            </div>
          </div>
        )}
      </AsyncSection>

      {confirming && (
        <ConfirmDialog
          title={
            confirming.action === 'verify' ? 'Confirmar verificación de pago'
              : confirming.action === 'reject' ? 'Confirmar rechazo de pago'
              : 'Confirmar efectivo recibido'
          }
          tone={confirming.action === 'reject' ? 'danger' : 'primary'}
          busy={busyCode === confirming.r.code}
          onCancel={() => setConfirming(null)}
          onConfirm={commit}
          confirmLabel={
            confirming.action === 'verify' ? 'Sí, ya lo verifiqué'
              : confirming.action === 'reject' ? 'Sí, rechazar pago'
              : 'Sí, recibí el efectivo'
          }
          description={
            <>
              {confirming.action === 'reject' ? (
                <>Vas a marcar el pago de <b>{confirming.r.code}</b> ({confirming.r.name}) por <b>{fmtCOP(confirming.r.paymentReport?.amount ?? confirming.r.estTotal)}</b> como <b>rechazado</b>. Esta acción no verifica ni confirma la reserva.</>
              ) : (
                <>
                  Estás a punto de marcar <b>{fmtCOP(confirming.r.paymentReport?.amount ?? confirming.r.estTotal)}</b> de <b>{confirming.r.name}</b> ({confirming.r.code}) como dinero real ya recibido.
                  {confirming.r.paymentReport && (
                    <> Revisa que el banco/referencia coincidan: <b>{confirming.r.paymentReport.bank}</b>, ref. <b>{confirming.r.paymentReport.reference}</b>, fecha {fmtDate(confirming.r.paymentReport.date)}.</>
                  )}
                  {' '}Esta acción no se puede deshacer desde el panel.
                  {confirming.r.priceCheck && !confirming.r.priceCheck.matchesReported && (
                    <p className="mt-2 rounded-lg bg-red/10 px-3 py-2 text-red-dark">
                      ⚠️ El total que el cliente reportó no coincide con el cálculo real según las tarifas vigentes de este apartamento (<b>{fmtCOP(confirming.r.priceCheck.expectedTotal)}</b>). El sitio web calcula ese número en el navegador del cliente — confírmalo contra la tarifa real antes de continuar.
                    </p>
                  )}
                </>
              )}
            </>
          }
        />
      )}
    </div>
  );
}
