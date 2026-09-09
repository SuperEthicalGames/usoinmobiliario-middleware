import { useEffect, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { api, ApiError, describeApiError } from '../api';
import type { AdminUser } from '../types';
import { useAuth } from '../AuthContext';
import { AsyncSection, Button, Card, PageHeader } from '../components/ui';

function fmtDateTime(iso: string | null): string {
  if (!iso) return 'Nunca';
  return new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
}

function CreateAdminForm({ onCreated }: { onCreated: (a: AdminUser) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.createAdmin(email.trim(), password);
      onCreated(created);
      setEmail('');
      setPassword('');
    } catch (err) {
      setError(err instanceof ApiError && err.code === 'auth/email-already-exists'
        ? 'Ya existe un administrador con ese correo.'
        : describeApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="p-6">
      <h2 className="mb-1 font-display text-lg font-semibold text-ink">Crear nuevo administrador</h2>
      <p className="mb-4 text-sm text-ink/60">
        Tendrá acceso a todo el panel (reservas, pagos, apartamentos) excepto esta pantalla — solo el administrador principal puede crear o revocar otros administradores.
      </p>
      <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block font-bold text-ink/80">Correo</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-line bg-paper px-3 py-2 outline-none focus:border-clay" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-bold text-ink/80">Contraseña temporal</span>
          <input type="text" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            className="rounded-lg border border-line bg-paper px-3 py-2 outline-none focus:border-clay" />
        </label>
        <Button type="submit" disabled={submitting}>{submitting ? 'Creando...' : 'Crear administrador'}</Button>
      </form>
      {error && <p className="mt-3 text-sm text-clay">{error}</p>}
      <p className="mt-3 text-xs text-ink/40">
        Comunícale esta contraseña de forma segura — puede cambiarla desde Configuración una vez que entre.
      </p>
    </Card>
  );
}

export function Admins() {
  const { user, isSuperAdmin } = useAuth();
  const [data, setData] = useState<AdminUser[] | null>(null);
  const [loading, setLoading] = useState(true);
  // Error de CARGAR la lista (va a AsyncSection, habilita "Reintentar") vs. error de una ACCIÓN
  // sobre una lista ya cargada (activar/desactivar) — si compartieran el mismo estado, un fallo
  // al desactivar a alguien haría que AsyncSection reemplace toda la tabla ya visible por la
  // pantalla de error, perdiendo de vista a los demás administradores sin razón.
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyUid, setBusyUid] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setLoadError(null);
    api.listAdmins().then(setData).catch((err) => setLoadError(describeApiError(err))).finally(() => setLoading(false));
  }
  useEffect(load, []);

  // Defensa en profundidad del lado del cliente — la restricción real ya la aplica el backend
  // (requireSuperAdmin devuelve 403), esto solo evita mostrarle la pantalla a quien de todas
  // formas no puede usarla.
  if (!isSuperAdmin) return <Navigate to="/" replace />;

  async function toggleDisabled(admin: AdminUser) {
    setBusyUid(admin.uid);
    setActionError(null);
    try {
      const updated = admin.disabled ? await api.enableAdmin(admin.uid) : await api.disableAdmin(admin.uid);
      setData((prev) => prev?.map((a) => (a.uid === updated.uid ? updated : a)) ?? prev);
    } catch (err) {
      setActionError(describeApiError(err));
    } finally {
      setBusyUid(null);
    }
  }

  return (
    <div>
      <PageHeader title="Administradores" subtitle="Solo tú (el administrador principal) puedes ver esta pantalla, crear cuentas nuevas o revocar acceso." />
      <div className="space-y-6">
        <CreateAdminForm onCreated={(a) => setData((prev) => (prev ? [...prev, a] : [a]))} />

        {actionError && <p className="text-sm text-clay">{actionError}</p>}
        <AsyncSection loading={loading} error={loadError} data={data} onRetry={load}>
          {(admins) => (
            <Card className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink/50">
                    <th className="px-4 py-3">Correo</th>
                    <th className="px-4 py-3">Rol</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Último ingreso</th>
                    <th className="px-4 py-3">Creado</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map((a) => {
                    const isSelf = a.uid === user?.uid;
                    return (
                      <tr key={a.uid} className="border-b border-line last:border-0">
                        <td className="px-4 py-3 font-bold">{a.email ?? <span className="italic text-ink/40">(sin correo — cuenta antigua)</span>}</td>
                        <td className="px-4 py-3">{isSelf ? 'Principal' : 'Administrador'}</td>
                        <td className="px-4 py-3">
                          <span className={a.disabled ? 'text-clay' : 'text-forest'}>{a.disabled ? 'Revocado' : 'Activo'}</span>
                        </td>
                        <td className="px-4 py-3 text-ink/70">{fmtDateTime(a.lastSignInAt)}</td>
                        <td className="px-4 py-3 text-ink/70">{fmtDateTime(a.createdAt)}</td>
                        <td className="px-4 py-3">
                          {!isSelf && (
                            <Button
                              variant={a.disabled ? 'primary' : 'danger'}
                              disabled={busyUid === a.uid}
                              onClick={() => toggleDisabled(a)}
                            >
                              {busyUid === a.uid ? '...' : a.disabled ? 'Reactivar' : 'Revocar'}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </AsyncSection>
      </div>
    </div>
  );
}
