import { useState, type FormEvent } from 'react';
import { useAuth } from '../AuthContext';
import { Button, Field } from '../components/ui';
import { AlertIcon } from '../components/icons';
import logoFull from '../assets/brand/logo-full.webp';

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
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex items-center justify-center bg-graphite-900 px-6 py-12 lg:py-0">
        <div className="max-w-xs text-center">
          <img src={logoFull} alt="Uso Inmobiliario" className="mx-auto w-44 sm:w-52" />
          <p className="mt-6 text-sm leading-relaxed text-graphite-400">
            Panel administrativo interno — reservas, pagos, visitas y apartamentos en un solo lugar.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center px-4 py-12 sm:py-16">
        <form onSubmit={onSubmit} className="w-full max-w-sm">
          <div className="mb-7">
            <h1 className="font-display text-xl font-semibold text-ink">Iniciar sesión</h1>
            <p className="mt-1 text-sm text-muted">Ingresa con tu cuenta de administrador.</p>
          </div>

          <div className="space-y-4">
            <Field
              label="Correo" type="email" required autoComplete="username" value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Field
              label="Contraseña" type="password" required autoComplete="current-password" value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-red/20 bg-red/5 px-3.5 py-2.5 text-sm text-red-dark">
              <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button type="submit" disabled={submitting} className="mt-6 w-full justify-center">
            {submitting ? 'Ingresando...' : 'Ingresar'}
          </Button>
        </form>
      </div>
    </div>
  );
}
