import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink/60">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-card shadow-sm ${className}`}>{children}</div>;
}

type Variant = 'primary' | 'ghost' | 'danger';
const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-forest text-paper hover:bg-forest-dk disabled:bg-forest/40',
  ghost: 'border border-line text-ink hover:border-clay hover:text-clay disabled:opacity-40',
  danger: 'bg-clay text-paper hover:brightness-95 disabled:bg-clay/40',
};

export function Button({
  variant = 'primary', className = '', children, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
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
  if (loading) return <p className="py-10 text-center text-sm text-ink/50">Cargando...</p>;
  if (error) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-clay">{error}</p>
        {onRetry && <button onClick={onRetry} className="mt-2 text-sm font-bold text-forest underline">Reintentar</button>}
      </div>
    );
  }
  const isEmptyArray = Array.isArray(data) && data.length === 0;
  if (data == null || isEmptyArray) return <p className="py-10 text-center text-sm text-ink/50">{empty ?? 'Sin datos.'}</p>;
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
