import { useEffect, useRef, useState } from 'react';
import { api, describeApiError } from '../api';
import type { DashboardSummary } from '../types';
import { AsyncSection, Card, PageHeader, Button, fmtDate } from '../components/ui';

// Cada tarjeta explica en una línea qué significa el número — la queja de que "el dashboard no
// se actualiza bien" muchas veces es en realidad "no sé si este número está fresco o qué
// significa" (ver el timestamp de "Actualizado hace..." más abajo para lo primero).
function StatCard({ label, value, tone = 'text-ink', hint }: { label: string; value: number; tone?: string; hint: string }) {
  return (
    <Card className="p-5">
      <div className="text-xs font-bold uppercase tracking-wide text-ink/50">{label}</div>
      <div className={`mt-1 font-display text-3xl font-semibold ${tone}`}>{value}</div>
      <div className="mt-1 text-xs text-ink/40">{hint}</div>
    </Card>
  );
}

const AUTO_REFRESH_MS = 30000;

export function Dashboard() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const loadingRef = useRef(false);

  // loadingRef (no solo el estado `loading`) evita que el refresco automático y uno manual se
  // pisen si el usuario hace clic en "Actualizar" justo cuando el intervalo de 30s también iba
  // a disparar — sin esto, dos respuestas llegando en momentos distintos podían hacer que el
  // spinner "parpadeara" o que una respuesta más vieja sobrescribiera una más nueva.
  function load(showSpinner: boolean) {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (showSpinner) setLoading(true);
    setError(null);
    api.getDashboard()
      .then((d) => { setData(d); setLastUpdated(new Date()); })
      .catch((err) => setError(describeApiError(err)))
      .finally(() => { setLoading(false); loadingRef.current = false; });
  }

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
  }, []);

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
          <div className="flex items-center gap-3">
            {lastUpdated && <span className="text-xs text-ink/40">Actualizado hace {secondsAgo}s</span>}
            <Button variant="ghost" onClick={() => load(true)} disabled={loading}>{loading ? 'Actualizando...' : 'Actualizar ahora'}</Button>
          </div>
        }
      />
      <AsyncSection loading={loading && !data} error={data ? null : error} data={data} onRetry={() => load(true)}>
        {(summary) => (
          <div className="space-y-8">
            {error && (
              <p className="rounded-lg bg-clay/10 px-4 py-2 text-sm text-clay">
                No se pudo actualizar ({error}) — mostrando los últimos datos que sí cargaron.
              </p>
            )}
            <div>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink/50">Apartamentos</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <StatCard label="Disponibles" value={summary.availableCount} tone="text-forest" hint="Libres para reservar ahora mismo" />
                <StatCard label="En uso" value={summary.inUseCount} tone="text-ochre" hint="Con una reserva confirmada activa hoy" />
                <StatCard label="Reservados" value={summary.reservedCount} tone="text-clay" hint="Con una reserva confirmada a futuro" />
              </div>
            </div>
            <div>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink/50">Reservas</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard label="Pendientes" value={summary.pendingReservations} hint="Esperando confirmación (incluye HOLDs activos y vencidos)" />
                <StatCard label="Confirmadas" value={summary.confirmedReservations} tone="text-forest" hint="Ya aprobadas por un administrador" />
                <StatCard label="HOLD activos" value={summary.activeHolds} tone="text-ochre" hint="Pendientes con los 15 minutos de reserva temporal aún corriendo" />
                <StatCard label="Pagos por verificar" value={summary.pendingPaymentVerifications} tone="text-clay" hint="El cliente ya reportó una transferencia — ver Pagos" />
              </div>
            </div>
            <div>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink/50">Próximas visitas</h2>
              <Card className="divide-y divide-line">
                {summary.upcomingVisits.length === 0 && <p className="p-5 text-sm text-ink/50">No hay visitas próximas.</p>}
                {summary.upcomingVisits.map((v) => (
                  <div key={v.code} className="flex items-center justify-between gap-4 px-5 py-3">
                    <div>
                      <div className="font-bold text-ink">{v.unitLabel}</div>
                      <div className="text-xs text-ink/50">{v.name} · {v.code}</div>
                    </div>
                    <div className="text-right text-sm text-ink/70">
                      <div>{fmtDate(v.visitDate)}</div>
                      <div className="text-xs text-ink/50">{v.visitTime}</div>
                    </div>
                  </div>
                ))}
              </Card>
            </div>
          </div>
        )}
      </AsyncSection>
    </div>
  );
}
