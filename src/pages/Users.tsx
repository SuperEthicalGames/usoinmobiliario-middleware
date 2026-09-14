import { useEffect, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { api, ApiError, describeApiError } from '../api';
import type { AdminUser } from '../types';
import { useAuth } from '../AuthContext';
import { AsyncSection, Button, Card, Field, Select } from '../components/ui';
import { AdminStatusBadge, RoleBadge } from '../components/StatusBadge';

function fmtDateTime(iso: string | null): string {
  if (!iso) return 'Nunca';
  return new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
}

function CreateUserForm({ onCreated }: { onCreated: (a: AdminUser) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'employee'>('admin');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.createUser(email.trim(), password, role);
      onCreated(created);
      setEmail('');
      setPassword('');
    } catch (err) {
      setError(err instanceof ApiError && err.code === 'auth/email-already-exists'
        ? 'Ya existe una cuenta con ese correo.'
        : describeApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="p-6">
      <h2 className="mb-1 font-display text-lg font-semibold text-ink">Crear cuenta nueva</h2>
      <p className="mb-4 text-sm text-muted">
        <b>Administrador</b>: acceso operativo completo (reservas, pagos, apartamentos, contratos, aseo, mantenimiento) excepto esta pantalla.{' '}
        <b>Empleado</b>: solo ve y actualiza las tareas de aseo/mantenimiento que le asignes, y sus notificaciones — nada de reservas, pagos ni datos financieros.
      </p>
      <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
        <Field label="Correo" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full sm:w-auto" />
        <Field
          label="Contraseña temporal" type="text" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="Mínimo 6 caracteres" className="w-full sm:w-auto"
        />
        <Select label="Rol" value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'employee')} className="w-full sm:w-auto">
          <option value="admin">Administrador</option>
          <option value="employee">Empleado</option>
        </Select>
        <Button type="submit" disabled={submitting} className="w-full sm:w-auto">{submitting ? 'Creando...' : 'Crear cuenta'}</Button>
      </form>
      {error && <p className="mt-3 text-sm text-red-dark">{error}</p>}
      <p className="mt-3 text-xs text-muted">
        Comunícale esta contraseña de forma segura — puede cambiarla desde Configuración una vez que entre.
      </p>
    </Card>
  );
}

export function Users() {
  const { user, isSuperAdmin } = useAuth();
  const [data, setData] = useState<AdminUser[] | null>(null);
  const [loading, setLoading] = useState(true);
  // Error de CARGAR la lista vs. error de una ACCIÓN sobre una lista ya cargada — mismo criterio
  // que ya usaba Admins.tsx (un fallo al desactivar a alguien no debe tapar a los demás usuarios
  // ya visibles con una pantalla de error genérica).
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyUid, setBusyUid] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setLoadError(null);
    api.listUsers().then(setData).catch((err) => setLoadError(describeApiError(err))).finally(() => setLoading(false));
  }
  useEffect(load, []);

  // Defensa en profundidad del lado del cliente — la restricción real ya la aplica el backend
  // (requireSuperAdmin/requireRole('owner') devuelve 403), esto solo evita mostrarle la
  // pantalla a quien de todas formas no puede usarla.
  if (!isSuperAdmin) return <Navigate to="/" replace />;

  async function toggleDisabled(u: AdminUser) {
    setBusyUid(u.uid);
    setActionError(null);
    try {
      const updated = u.disabled ? await api.enableUser(u.uid) : await api.disableUser(u.uid);
      setData((prev) => prev?.map((x) => (x.uid === updated.uid ? { ...x, ...updated } : x)) ?? prev);
    } catch (err) {
      setActionError(describeApiError(err));
    } finally {
      setBusyUid(null);
    }
  }

  async function toggleRole(u: AdminUser) {
    const nextRole = u.role === 'employee' ? 'admin' : 'employee';
    setBusyUid(u.uid);
    setActionError(null);
    try {
      await api.setUserRole(u.uid, nextRole);
      setData((prev) => prev?.map((x) => (x.uid === u.uid ? { ...x, role: nextRole } : x)) ?? prev);
    } catch (err) {
      setActionError(describeApiError(err));
    } finally {
      setBusyUid(null);
    }
  }

  return (
    <div>
      <p className="mb-5 text-sm text-muted">Solo tú (el dueño) puedes ver esta pestaña, crear cuentas, cambiar su rol o revocar acceso.</p>
      <div className="space-y-6">
        <CreateUserForm onCreated={(a) => setData((prev) => (prev ? [...prev, a] : [a]))} />

        {actionError && <p className="rounded-xl bg-red/10 px-3.5 py-2.5 text-sm text-red-dark">{actionError}</p>}
        <AsyncSection loading={loading} error={loadError} data={data} onRetry={load}>
          {(users) => (
            <Card className="overflow-hidden">
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                      <th className="px-4 py-3">Correo</th>
                      <th className="px-4 py-3">Rol</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3">Último ingreso</th>
                      <th className="px-4 py-3">Creado</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((a) => {
                      const isSelf = a.uid === user?.uid;
                      const isOwner = a.role === 'owner';
                      return (
                        <tr key={a.uid} className="border-b border-line last:border-0">
                          <td className="px-4 py-3 font-bold text-ink">{a.email ?? <span className="italic text-muted">(sin correo — cuenta antigua)</span>}</td>
                          <td className="px-4 py-3"><RoleBadge role={a.role} /></td>
                          <td className="px-4 py-3"><AdminStatusBadge disabled={a.disabled} /></td>
                          <td className="px-4 py-3 text-ink/70">{fmtDateTime(a.lastSignInAt)}</td>
                          <td className="px-4 py-3 text-ink/70">{fmtDateTime(a.createdAt)}</td>
                          <td className="px-4 py-3">
                            {!isOwner && !isSelf && (
                              <div className="flex justify-end gap-2">
                                <Button variant="ghost" disabled={busyUid === a.uid} onClick={() => toggleRole(a)}>
                                  {busyUid === a.uid ? '...' : a.role === 'employee' ? 'Hacer admin' : 'Hacer empleado'}
                                </Button>
                                <Button
                                  variant={a.disabled ? 'primary' : 'danger'}
                                  disabled={busyUid === a.uid}
                                  onClick={() => toggleDisabled(a)}
                                >
                                  {busyUid === a.uid ? '...' : a.disabled ? 'Reactivar' : 'Revocar'}
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-line md:hidden">
                {users.map((a) => {
                  const isSelf = a.uid === user?.uid;
                  const isOwner = a.role === 'owner';
                  return (
                    <div key={a.uid} className="flex flex-col gap-2 px-4 py-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-ink">{a.email ?? <span className="italic text-muted">(sin correo)</span>}</div>
                          <div className="mt-1"><RoleBadge role={a.role} /></div>
                        </div>
                        <AdminStatusBadge disabled={a.disabled} />
                      </div>
                      <div className="text-xs text-muted">Último ingreso: {fmtDateTime(a.lastSignInAt)}</div>
                      <div className="text-xs text-muted">Creado: {fmtDateTime(a.createdAt)}</div>
                      {!isOwner && !isSelf && (
                        <div className="mt-1 flex gap-2">
                          <Button variant="ghost" disabled={busyUid === a.uid} onClick={() => toggleRole(a)} className="flex-1 justify-center">
                            {busyUid === a.uid ? '...' : a.role === 'employee' ? 'Hacer admin' : 'Hacer empleado'}
                          </Button>
                          <Button
                            variant={a.disabled ? 'primary' : 'danger'}
                            disabled={busyUid === a.uid}
                            onClick={() => toggleDisabled(a)}
                            className="flex-1 justify-center"
                          >
                            {busyUid === a.uid ? '...' : a.disabled ? 'Reactivar' : 'Revocar'}
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </AsyncSection>
      </div>
    </div>
  );
}
