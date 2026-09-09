import { useState, type FormEvent } from 'react';
import { useAuth } from '../AuthContext';
import { Button } from '../components/ui';

const ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/invalid-email': 'Correo inválido.',
  'auth/too-many-requests': 'Demasiados intentos. Espera un momento y vuelve a intentar.',
};

export function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (err) {
      const code = (err as { code?: string }).code ?? '';
      setError(ERROR_MESSAGES[code] ?? 'No se pudo iniciar sesión. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-2xl border border-line bg-card p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="font-display text-xl font-semibold text-ink">
            USO <em className="text-clay not-italic">Inmobiliario</em>
          </div>
          <p className="mt-1 text-xs uppercase tracking-wide text-ink/50">Panel administrativo</p>
        </div>

        <label className="mb-3 block text-sm">
          <span className="mb-1 block font-bold text-ink/80">Correo</span>
          <input
            type="email" required autoComplete="username" value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-line bg-paper px-3 py-2 outline-none focus:border-clay"
          />
        </label>
        <label className="mb-5 block text-sm">
          <span className="mb-1 block font-bold text-ink/80">Contraseña</span>
          <input
            type="password" required autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-line bg-paper px-3 py-2 outline-none focus:border-clay"
          />
        </label>

        {error && <p className="mb-4 text-sm text-clay">{error}</p>}

        <Button type="submit" disabled={submitting} className="w-full justify-center">
          {submitting ? 'Ingresando...' : 'Ingresar'}
        </Button>
      </form>
    </div>
  );
}
