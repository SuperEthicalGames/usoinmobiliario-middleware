import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api, describeApiError } from '../api';
import type { AuditLogEntry } from '../types';
import { useAuth } from '../AuthContext';
import { AsyncSection, Card, PageHeader } from '../components/ui';

// Etiquetas legibles para las acciones que fb.logAdminAction registra (ver adminRoutes.js) —
// cualquier acción nueva que no esté acá simplemente se muestra tal cual (el string ya es
// razonablemente legible, ej. "cleaning.set_status"), nunca se rompe por un mapeo faltante.
const ACTION_LABELS: Record<string, string> = {
  'reservation.create_manual': 'Creó una reserva manual',
  'reservation.check_in': 'Registró check-in',
  'reservation.check_out': 'Registró check-out',
  'record.confirm': 'Confirmó reserva/cita',
  'record.reject': 'Rechazó reserva/cita',
  'record.cancel': 'Canceló reserva/cita',
  'record.complete': 'Completó reserva/cita',
  'payment_info.update': 'Editó los datos bancarios',
  'admin.create': 'Creó un administrador',
  'admin.disable': 'Revocó un administrador',
  'admin.enable': 'Reactivó un administrador',
  'payment.verify': 'Verificó un pago',
  'payment.reject': 'Rechazó un pago',
  'payment.register_cash': 'Registró un pago en efectivo',
  'contract.create': 'Creó un contrato',
  'contract.set_status': 'Cambió el estado de un contrato',
  'cleaning.create': 'Creó una tarea de aseo',
  'cleaning.set_status': 'Cambió el estado de una tarea de aseo',
  'maintenance.create': 'Creó un ticket de mantenimiento',
  'maintenance.set_status': 'Cambió el estado de un ticket de mantenimiento',
};

function fmtDateTime(ms: number): string {
  return new Date(ms).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'medium' });
}

function fmtMetadata(metadata: AuditLogEntry['metadata']): string | null {
  if (!metadata) return null;
  const parts = Object.entries(metadata)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}: ${v}`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function AuditLog() {
  const { isSuperAdmin } = useAuth();
  const [data, setData] = useState<AuditLogEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    api.getAuditLog().then(setData).catch((err) => setError(describeApiError(err))).finally(() => setLoading(false));
  }
  useEffect(load, []);

  // Defensa en profundidad del lado del cliente — la restricción real ya la aplica el backend
  // (requireSuperAdmin devuelve 403), esto solo evita mostrarle la pantalla a quien de todas
  // formas no puede usarla. Mismo criterio que Admins.tsx.
  if (!isSuperAdmin) return <Navigate to="/" replace />;

  return (
    <div>
      <PageHeader
        title="Bitácora"
        subtitle="Quién hizo qué en el panel — las últimas 200 acciones administrativas que cambiaron algo real (reservas, pagos, contratos, administradores)."
      />
      <AsyncSection loading={loading} error={error} data={data} onRetry={load} empty="Todavía no hay acciones registradas.">
        {(entries) => (
          <Card className="overflow-hidden">
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-4 py-3">Cuándo</th>
                    <th className="px-4 py-3">Quién</th>
                    <th className="px-4 py-3">Acción</th>
                    <th className="px-4 py-3">Sobre</th>
                    <th className="px-4 py-3">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} className="border-b border-line last:border-0">
                      <td className="whitespace-nowrap px-4 py-3 text-ink/70">{fmtDateTime(e.timestamp)}</td>
                      <td className="px-4 py-3 font-bold text-ink">{e.actorEmail ?? <span className="italic text-muted">desconocido</span>}</td>
                      <td className="px-4 py-3 text-ink/70">{ACTION_LABELS[e.action] ?? e.action}</td>
                      <td className="px-4 py-3 font-mono text-xs text-ink/70">{e.target ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-muted">{fmtMetadata(e.metadata) ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-line md:hidden">
              {entries.map((e) => (
                <div key={e.id} className="flex flex-col gap-1 px-4 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-ink">{ACTION_LABELS[e.action] ?? e.action}</span>
                    <span className="shrink-0 text-xs text-muted">{fmtDateTime(e.timestamp)}</span>
                  </div>
                  <div className="text-xs text-muted">{e.actorEmail ?? 'desconocido'}</div>
                  {e.target && <div className="font-mono text-xs text-ink/70">{e.target}</div>}
                  {fmtMetadata(e.metadata) && <div className="text-xs text-muted">{fmtMetadata(e.metadata)}</div>}
                </div>
              ))}
            </div>
          </Card>
        )}
      </AsyncSection>
    </div>
  );
}
