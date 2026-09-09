import { useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import type { DashboardSummary } from '../types';
import { AsyncSection, Card, PageHeader, Button, fmtDate } from '../components/ui';

function StatCard({ label, value, tone = 'text-ink' }: { label: string; value: number; tone?: string }) {
  return (
    <Card className="p-5">
      <div className="text-xs font-bold uppercase tracking-wide text-ink/50">{label}</div>
      <div className={`mt-1 font-display text-3xl font-semibold ${tone}`}>{value}</div>
    </Card>
  );
}

export function Dashboard() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    api.getDashboard()
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? `No se pudo cargar el dashboard (${err.code}).` : 'No se pudo cargar el dashboard.'))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Resumen en tiempo real del negocio." action={<Button variant="ghost" onClick={load}>Actualizar</Button>} />
      <AsyncSection loading={loading} error={error} data={data} onRetry={load}>
        {(summary) => (
          <div className="space-y-8">
            <div>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink/50">Apartamentos</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <StatCard label="Disponibles" value={summary.availableCount} tone="text-forest" />
                <StatCard label="En uso" value={summary.inUseCount} tone="text-ochre" />
                <StatCard label="Reservados" value={summary.reservedCount} tone="text-clay" />
              </div>
            </div>
            <div>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink/50">Reservas</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard label="Pendientes" value={summary.pendingReservations} />
                <StatCard label="Confirmadas" value={summary.confirmedReservations} tone="text-forest" />
                <StatCard label="HOLD activos" value={summary.activeHolds} tone="text-ochre" />
                <StatCard label="Pagos por verificar" value={summary.pendingPaymentVerifications} tone="text-clay" />
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
