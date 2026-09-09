import { useEffect, useState, type FormEvent } from 'react';
import { updatePassword } from 'firebase/auth';
import { api, ApiError, describeApiError } from '../api';
import type { PaymentInfo } from '../types';
import { useAuth } from '../AuthContext';
import { AsyncSection, Button, Card, PageHeader } from '../components/ui';

const EMPTY_INFO: PaymentInfo = { bankName: '', accountHolder: '', accountType: '', accountNumber: '' };

function PaymentInfoCard() {
  const { isSuperAdmin } = useAuth();
  const [data, setData] = useState<PaymentInfo | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<PaymentInfo>(EMPTY_INFO);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    api.getPaymentInfo()
      .then((info) => { setData(info); setForm(info ?? EMPTY_INFO); })
      .catch((err) => setError(describeApiError(err)))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await api.updatePaymentInfo(form);
      setData(updated);
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof ApiError && err.code === 'not-super-admin'
        ? 'Solo el administrador principal puede editar los datos bancarios.'
        : describeApiError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-ink">Datos bancarios</h2>
        {isSuperAdmin && !editing && (
          <Button variant="ghost" onClick={() => { setForm(data ?? EMPTY_INFO); setEditing(true); }}>Editar</Button>
        )}
      </div>
      <p className="mb-4 text-xs text-ink/40">
        Es la cuenta que se le muestra a los clientes cuando eligen pagar por transferencia (en el sitio y en el bot de WhatsApp) — un dato equivocado acá afecta pagos reales.
      </p>

      {editing ? (
        <form onSubmit={onSave} className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block font-bold text-ink/80">Banco</span>
            <input required value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2 outline-none focus:border-clay" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-bold text-ink/80">Titular</span>
            <input required value={form.accountHolder} onChange={(e) => setForm({ ...form, accountHolder: e.target.value })}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2 outline-none focus:border-clay" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-bold text-ink/80">Tipo de cuenta</span>
            <input required value={form.accountType} onChange={(e) => setForm({ ...form, accountType: e.target.value })}
              placeholder="Ahorros / Corriente"
              className="w-full rounded-lg border border-line bg-paper px-3 py-2 outline-none focus:border-clay" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-bold text-ink/80">Número de cuenta</span>
            <input required value={String(form.accountNumber)} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2 outline-none focus:border-clay" />
          </label>
          {saveError && <p className="text-sm text-clay">{saveError}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</Button>
            <Button type="button" variant="ghost" disabled={saving} onClick={() => setEditing(false)}>Cancelar</Button>
          </div>
        </form>
      ) : (
        <AsyncSection loading={loading} error={error} data={data} empty="No hay datos bancarios configurados todavía." onRetry={load}>
          {(info) => (
            <div className="space-y-1.5 text-sm">
              <div><span className="text-ink/50">Banco:</span> <span className="font-bold">{info.bankName}</span></div>
              <div><span className="text-ink/50">Titular:</span> <span className="font-bold">{info.accountHolder}</span></div>
              <div><span className="text-ink/50">Tipo de cuenta:</span> <span className="font-bold">{info.accountType}</span></div>
              <div><span className="text-ink/50">Número de cuenta:</span> <span className="font-bold">{info.accountNumber}</span></div>
            </div>
          )}
        </AsyncSection>
      )}
      {!isSuperAdmin && (
        <p className="mt-4 text-xs text-ink/40">Solo lectura — pídele al administrador principal que lo edite si hace falta.</p>
      )}
    </Card>
  );
}

function ChangePasswordCard() {
  const { user } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) {
      setMessage({ text: 'La contraseña debe tener al menos 6 caracteres.', tone: 'error' });
      return;
    }
    if (newPassword !== confirm) {
      setMessage({ text: 'Las contraseñas no coinciden.', tone: 'error' });
      return;
    }
    if (!user) return;
    setSubmitting(true);
    setMessage(null);
    try {
      await updatePassword(user, newPassword);
      setMessage({ text: 'Contraseña actualizada.', tone: 'ok' });
      setNewPassword('');
      setConfirm('');
    } catch (err) {
      const code = (err as { code?: string }).code ?? '';
      const text = code === 'auth/requires-recent-login'
        ? 'Por seguridad, cierra sesión y vuelve a entrar antes de cambiar la contraseña.'
        : 'No se pudo actualizar la contraseña.';
      setMessage({ text, tone: 'error' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="p-6">
      <h2 className="mb-1 font-display text-lg font-semibold text-ink">Cuenta</h2>
      <p className="mb-4 text-sm text-ink/50">{user?.email}</p>
      <form onSubmit={onSubmit} className="max-w-xs space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block font-bold text-ink/80">Nueva contraseña</span>
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-lg border border-line bg-paper px-3 py-2 outline-none focus:border-clay" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-bold text-ink/80">Confirmar</span>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-lg border border-line bg-paper px-3 py-2 outline-none focus:border-clay" />
        </label>
        {message && <p className={`text-sm ${message.tone === 'ok' ? 'text-forest' : 'text-clay'}`}>{message.text}</p>}
        <Button type="submit" variant="ghost" disabled={submitting}>{submitting ? 'Guardando...' : 'Cambiar contraseña'}</Button>
      </form>
    </Card>
  );
}

export function Settings() {
  return (
    <div>
      <PageHeader title="Configuración" />
      <div className="grid max-w-2xl gap-6">
        <ChangePasswordCard />
        <PaymentInfoCard />
      </div>
    </div>
  );
}
