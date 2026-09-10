import { useEffect, useState, type FormEvent } from 'react';
import { updatePassword } from 'firebase/auth';
import { api, ApiError, describeApiError } from '../api';
import type { PaymentInfo } from '../types';
import { useAuth } from '../AuthContext';
import { AsyncSection, Button, Card, Field, PageHeader } from '../components/ui';

const EMPTY_INFO: PaymentInfo = { bankName: '', accountHolder: '', accountType: '', accountNumber: '' };

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line py-2 text-sm last:border-0">
      <span className="text-muted">{label}</span>
      <span className="font-bold text-ink">{value}</span>
    </div>
  );
}

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
      <div className="mb-1 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-ink">Datos bancarios</h2>
        {isSuperAdmin && !editing && (
          <Button variant="ghost" onClick={() => { setForm(data ?? EMPTY_INFO); setEditing(true); }}>Editar</Button>
        )}
      </div>
      <p className="mb-4 text-xs text-muted">
        Es la cuenta que se le muestra a los clientes cuando eligen pagar por transferencia (en el sitio y en el bot de WhatsApp) — un dato equivocado acá afecta pagos reales.
      </p>

      {editing ? (
        <form onSubmit={onSave} className="space-y-3">
          <Field label="Banco" required value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} />
          <Field label="Titular" required value={form.accountHolder} onChange={(e) => setForm({ ...form, accountHolder: e.target.value })} />
          <Field
            label="Tipo de cuenta" required value={form.accountType} onChange={(e) => setForm({ ...form, accountType: e.target.value })}
            placeholder="Ahorros / Corriente"
          />
          <Field label="Número de cuenta" required value={String(form.accountNumber)} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} />
          {saveError && <p className="text-sm text-red-dark">{saveError}</p>}
          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</Button>
            <Button type="button" variant="ghost" disabled={saving} onClick={() => setEditing(false)}>Cancelar</Button>
          </div>
        </form>
      ) : (
        <AsyncSection loading={loading} error={error} data={data} empty="No hay datos bancarios configurados todavía." onRetry={load}>
          {(info) => (
            <div>
              <InfoRow label="Banco" value={info.bankName} />
              <InfoRow label="Titular" value={info.accountHolder} />
              <InfoRow label="Tipo de cuenta" value={info.accountType} />
              <InfoRow label="Número de cuenta" value={info.accountNumber} />
            </div>
          )}
        </AsyncSection>
      )}
      {!isSuperAdmin && (
        <p className="mt-4 text-xs text-muted">Solo lectura — pídele al administrador principal que lo edite si hace falta.</p>
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
      <p className="mb-4 text-sm text-muted">{user?.email}</p>
      <form onSubmit={onSubmit} className="max-w-xs space-y-3">
        <Field label="Nueva contraseña" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        <Field label="Confirmar" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        {message && <p className={`text-sm ${message.tone === 'ok' ? 'text-emerald-dark' : 'text-red-dark'}`}>{message.text}</p>}
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
