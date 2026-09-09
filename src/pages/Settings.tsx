import { useEffect, useState, type FormEvent } from 'react';
import { updatePassword } from 'firebase/auth';
import { api, ApiError } from '../api';
import type { PaymentInfo } from '../types';
import { useAuth } from '../AuthContext';
import { AsyncSection, Button, Card, PageHeader } from '../components/ui';

function PaymentInfoCard() {
  const [data, setData] = useState<PaymentInfo | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getPaymentInfo()
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? `No se pudo cargar (${err.code}).` : 'No se pudo cargar.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card className="p-6">
      <h2 className="mb-4 font-display text-lg font-semibold text-ink">Datos bancarios (solo lectura)</h2>
      <AsyncSection loading={loading} error={error} data={data} empty="No hay datos bancarios configurados en Firebase todavía.">
        {(info) => (
          <div className="space-y-1.5 text-sm">
            <div><span className="text-ink/50">Banco:</span> <span className="font-bold">{info.bankName}</span></div>
            <div><span className="text-ink/50">Titular:</span> <span className="font-bold">{info.accountHolder}</span></div>
            <div><span className="text-ink/50">Tipo de cuenta:</span> <span className="font-bold">{info.accountType}</span></div>
            <div><span className="text-ink/50">Número de cuenta:</span> <span className="font-bold">{info.accountNumber}</span></div>
          </div>
        )}
      </AsyncSection>
      <p className="mt-4 text-xs text-ink/40">
        Se edita solo desde la consola de Firebase (settings/paymentInfo) — este panel nunca lo modifica, mismo criterio que el sitio público.
      </p>
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
