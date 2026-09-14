import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, describeApiError } from '../api';
import type { AuditLogEntry, DashboardSummary } from '../types';
import { useAuth } from '../AuthContext';
import { AsyncSection, Card, PageHeader, Button, fmtDate } from '../components/ui';
import { StatusBadge } from '../components/StatusBadge';
import { RefreshIcon } from '../components/icons';
import { ACTION_LABELS, fmtDateTime } from './AuditLog';

// Cada tarjeta explica en una línea qué significa el número — la queja de que "el dashboard no
// se actualiza bien" muchas veces es en realidad "no sé si este número está fresco o qué
// significa" (ver el timestamp de "Actualizado hace..." más abajo para lo primero).
//
// `to` es opcional — cuando viene, la tarjeta entera es un link a la pantalla real donde ese
// número se explica/gestiona (pedido explícito del dueño: "más interactivo"), con el mismo
// hover que ya usa Card en Apartamentos. Sin `to`, se queda como antes (solo informativa).
function StatCard({ label, value, tone = 'text-ink', hint, to }: {
  label: string; value: number; tone?: string; hint: string; to?: string;
}) {
  const body = (
    <>
      <div className="text-xs font-bold uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-1.5 font-display text-3xl font-semibold ${tone}`}>{value}</div>
      <div className="mt-1.5 text-xs text-muted/80">{hint}</div>
    </>
  );
  if (to) {
    return (
      <Link to={to} className="block">
        <Card className="p-5" hoverable>{body}</Card>
      </Link>
    );
  }
  return <Card className="p-5">{body}</Card>;
}

function SectionLabel({ children }: { children: string }) {
  return <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">{children}</h2>;
}

const AUTO_REFRESH_MS = 30000;
const RECENT_ACTIVITY_LIMIT = 6;

export function Dashboard() {
  const { isSuperAdmin } = useAuth();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [activity, setActivity] = useState<AuditLogEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const loadingRef = useRef(false);

  // loadingRef (no solo el estado `loading`) evita que el refresco automático y uno manual se
  // pisen si el usuario hace clic en "Actualizar" justo cuando el intervalo de 30s también iba
  // a disparar — sin esto, dos respuestas llegando en momentos distintos podían hacer que el
  // spinner "parpadeara" o que una respuesta más vieja sobrescribiera una más nueva.
  // useCallback (no una función suelta) para que el useEffect de abajo pueda declarar su
  // dependencia real sin volver a correr en cada render — solo cambia cuando isSuperAdmin
  // cambia, que es exactamente cuándo debe volver a decidir si pedir Bitácora o no.
  const load = useCallback((showSpinner: boolean) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (showSpinner) setLoading(true);
    setError(null);
    // Actividad reciente es un fetch APARTE de /dashboard (STAFF) — /audit-log es solo-dueño
    // (requireSuperAdmin), meterlo en el resumen filtraría al admin no-dueño algo que Bitácora
    // restringe a propósito. Solo se pide si de verdad se va a mostrar.
    Promise.all([
      api.getDashboard(),
      isSuperAdmin ? api.getAuditLog(RECENT_ACTIVITY_LIMIT) : Promise.resolve(null),
    ])
      .then(([d, act]) => { setData(d); setActivity(act); setLastUpdated(new Date()); })
      .catch((err) => setError(describeApiError(err)))
      .finally(() => { setLoading(false); loadingRef.current = false; });
  }, [isSuperAdmin]);

  useEffect(() => {
    load(true);
    // Refresco automático mientras la pantalla está abierta — así una acción hecha en Reservas/
    // Pagos y luego volver al Dashboard (o simplemente dejarlo abierto) no se ve "atascada" en
    // números viejos hasta que alguien piense en darle clic a Actualizar.
    const interval = setInterval(() => load(false), AUTO_REFRESH_MS);
    // Refresco también cuando la pestaña vuelve a estar visible (ej. el admin la dejó abierta
    // en segundo plano y volvió después de un rato).
    function onVisible() { if (document.visibilityState === 'visible') load(false); }
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisible); };
  }, [load]);

  useEffect(() => {
    if (!lastUpdated) return;
    setSecondsAgo(0);
    const tick = setInterval(() => setSecondsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000)), 1000);
    return () => clearInterval(tick);
  }, [lastUpdated]);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Resumen en tiempo real del negocio — se actualiza solo cada 30 segundos."
        action={
          <div className="flex flex-wrap items-center gap-3">
            {lastUpdated && <span className="text-xs text-muted">Actualizado hace {secondsAgo}s</span>}
            <Button variant="ghost" onClick={() => load(true)} disabled={loading}>
              <RefreshIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Actualizando...' : 'Actualizar ahora'}
            </Button>
          </div>
        }
      />
      <AsyncSection loading={loading && !data} error={data ? null : error} data={data} onRetry={() => load(true)}>
        {(summary) => (
          <div className="space-y-8">
            {error && (
              <p className="rounded-xl bg-red/10 px-4 py-2.5 text-sm text-red-dark">
                No se pudo actualizar ({error}) — mostrando los últimos datos que sí cargaron.
              </p>
            )}
            <div>
              <SectionLabel>Apartamentos</SectionLabel>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <StatCard label="Disponibles" value={summary.availableCount} tone="text-emerald" hint="Libres para reservar ahora mismo" to="/apartamentos" />
                <StatCard label="En uso" value={summary.inUseCount} tone="text-amber" hint="Con una reserva confirmada activa hoy" to="/apartamentos" />
                <StatCard label="Reservados" value={summary.reservedCount} tone="text-gold-dark" hint="Con una reserva confirmada a futuro" to="/apartamentos" />
              </div>
            </div>
            <div>
              <SectionLabel>Reservas</SectionLabel>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard label="Pendientes" value={summary.pendingReservations} hint="Esperando confirmación (incluye HOLDs activos y vencidos)" to="/reservas" />
                <StatCard label="Confirmadas" value={summary.confirmedReservations} tone="text-emerald" hint="Ya aprobadas por un administrador" to="/reservas" />
                <StatCard label="HOLD activos" value={summary.activeHolds} tone="text-amber" hint="Pendientes con los 15 minutos de reserva temporal aún corriendo" to="/reservas" />
                <StatCard label="Pagos por verificar" value={summary.pendingPaymentVerifications} tone="text-gold-dark" hint="El cliente ya reportó una transferencia — ver Pagos" to="/pagos" />
              </div>
            </div>
            <div>
              <SectionLabel>Operación</SectionLabel>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                <StatCard label="Fotos reales pendientes" value={summary.apartmentsNeedingRealPhotos} tone="text-gold-dark" hint="Apartamentos que todavía muestran la foto de vista previa" to="/apartamentos" />
                <StatCard label="Efectivo por registrar" value={summary.pendingCashPayments} tone="text-gold-dark" hint="Reserva eligió pagar en efectivo, falta confirmar recibido" to="/pagos" />
                <StatCard label="Aseo pendiente" value={summary.cleaningPending} hint="Tareas de aseo todavía sin empezar" to="/aseo" />
                <StatCard label="Mantenimiento abierto" value={summary.maintenanceOpen} tone="text-amber" hint="Tickets sin marcar como resueltos" to="/mantenimiento" />
                <StatCard label="Contratos por vencer" value={summary.contractsExpiringSoon} tone="text-red-dark" hint="Activos, terminan en los próximos 30 días" to="/contratos" />
              </div>
            </div>
            <div>
              <SectionLabel>Próximas visitas</SectionLabel>
              <p className="-mt-2 mb-3 text-xs text-muted/80">Confirmadas y pendientes de confirmar, de hoy en adelante — rechazadas/canceladas/completadas no aparecen acá.</p>
              <Card className="divide-y divide-line">
                {summary.upcomingVisits.length === 0 && <p className="p-5 text-sm text-muted">No hay visitas próximas.</p>}
                {summary.upcomingVisits.map((v) => (
                  <div key={v.code} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3.5">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-ink">{v.unitLabel}</span>
                        <StatusBadge status={v.status} />
                      </div>
                      <div className="text-xs text-muted">{v.name} · {v.code}</div>
                    </div>
                    <div className="text-right text-sm text-ink/70">
                      <div>{fmtDate(v.visitDate)}</div>
                      <div className="text-xs text-muted">{v.visitTime}</div>
                    </div>
                  </div>
                ))}
              </Card>
            </div>
            {isSuperAdmin && activity && (
              <div>
                <SectionLabel>Actividad reciente</SectionLabel>
                <Card className="divide-y divide-line">
                  {activity.length === 0 && <p className="p-5 text-sm text-muted">Todavía no hay acciones registradas.</p>}
                  {activity.map((e) => (
                    <div key={e.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3.5">
                      <div>
                        <span className="font-bold text-ink">{ACTION_LABELS[e.action] ?? e.action}</span>
                        <div className="text-xs text-muted">{e.actorEmail ?? 'desconocido'}{e.target ? ` · ${e.target}` : ''}</div>
                      </div>
                      <div className="text-xs text-muted">{fmtDateTime(e.timestamp)}</div>
                    </div>
                  ))}
                </Card>
                <Link to="/bitacora" className="mt-2 inline-block text-xs font-bold text-gold-dark hover:underline">
                  Ver bitácora completa →
                </Link>
              </div>
            )}
          </div>
        )}
      </AsyncSection>
    </div>
  );
}
