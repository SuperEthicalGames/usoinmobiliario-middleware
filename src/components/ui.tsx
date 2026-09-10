import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4 sm:mb-8">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-[1.75rem]">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-sm text-muted">{subtitle}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-3">{action}</div>}
    </div>
  );
}

// hoverable: para tarjetas que SON un solo objeto clickeable (grid de apartamentos, ítems de
// lista) — un ligero ascenso + sombra más marcada confirma "esto responde". Deliberadamente
// NO es el default: una Card que solo envuelve una tabla/formulario no debería "flotar" cada
// vez que el mouse pasa sobre una fila o un input de adentro.
export function Card({ children, className = '', hoverable = false }: { children: ReactNode; className?: string; hoverable?: boolean }) {
  return (
    <div
      className={`animate-card-in rounded-2xl border border-line bg-card shadow-[0_1px_2px_rgba(16,20,26,0.05),0_1px_1px_rgba(16,20,26,0.03)] transition-all duration-200 ${
        hoverable ? 'hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(16,20,26,0.09),0_2px_6px_rgba(16,20,26,0.06)] hover:border-line' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}

type Variant = 'primary' | 'ghost' | 'danger';
const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-gold text-ink hover:bg-gold-light active:bg-gold-dark active:text-white disabled:bg-gold/40 disabled:text-ink/50',
  ghost: 'border border-line text-ink hover:border-gold hover:text-gold-dark disabled:opacity-40',
  danger: 'bg-red text-white hover:bg-red-dark disabled:bg-red/40',
};

export function Button({
  variant = 'primary', className = '', children, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

// Mismo look en los 4 formularios de la app (Login, Reserva manual, Configuración,
// Administradores) — un solo lugar para el borde/foco de un input en vez de repetirlo.
const FIELD_CLASS = 'w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-ink outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/15 disabled:opacity-50';

export function Field({ label, className = '', ...rest }: { label: string; className?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1.5 block font-semibold text-ink/80">{label}</span>
      <input {...rest} className={FIELD_CLASS} />
    </label>
  );
}

export function TextArea({ label, className = '', ...rest }: { label: string; className?: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1.5 block font-semibold text-ink/80">{label}</span>
      <textarea {...rest} className={FIELD_CLASS} />
    </label>
  );
}

export function Select({ label, children, className = '', ...rest }: { label: string; className?: string; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1.5 block font-semibold text-ink/80">{label}</span>
      <select {...rest} className={FIELD_CLASS}>{children}</select>
    </label>
  );
}

// Banner de doble verificación — se interpone entre el clic y la llamada real a la API para
// cualquier acción sobre dinero real (verificar/rechazar pago, registrar efectivo): un solo
// clic accidental en la tabla de Pagos ya no puede marcar plata como confirmada por error.
export function ConfirmDialog({ title, description, confirmLabel, tone = 'primary', busy, onConfirm, onCancel }: {
  title: string; description: ReactNode; confirmLabel: string; tone?: 'primary' | 'danger'; busy?: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-graphite-950/50 p-4" onClick={onCancel}>
      <div className="animate-card-in w-full max-w-sm rounded-2xl border border-line bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
        <div className="mt-2 text-sm leading-relaxed text-ink/70">{description}</div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>Cancelar</Button>
          <Button variant={tone} onClick={onConfirm} disabled={busy}>{busy ? '...' : confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={`animate-spin text-gold ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// Estado uniforme de carga/error/vacío — evita repetir este boilerplate en cada pantalla.
export function AsyncSection<T>({
  loading, error, data, empty, onRetry, children,
}: {
  loading: boolean;
  error: string | null;
  data: T | null | undefined;
  empty?: string;
  onRetry?: () => void;
  children: (data: T) => ReactNode;
}) {
  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <Spinner />
        <p className="text-sm text-muted">Cargando...</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-dashed border-line py-12 text-center">
        <p className="text-sm font-medium text-red">{error}</p>
        {onRetry && (
          <button onClick={onRetry} className="mt-3 text-sm font-bold text-gold-dark hover:underline">
            Reintentar
          </button>
        )}
      </div>
    );
  }
  const isEmptyArray = Array.isArray(data) && data.length === 0;
  if (data == null || isEmptyArray) {
    return (
      <div className="rounded-2xl border border-dashed border-line py-12 text-center">
        <p className="text-sm text-muted">{empty ?? 'Sin datos.'}</p>
      </div>
    );
  }
  return <>{children(data)}</>;
}

export function fmtCOP(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n === 0) return '$0';
  return '$' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function fmtDate(iso: string | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
