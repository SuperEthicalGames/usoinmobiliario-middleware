import { useId, useState } from 'react';
import { Card } from './ui';

// Componentes de gráfico hechos a mano (sin librería) — el bundle de este panel no tenía
// ninguna dependencia de charting, y el set de marcas que hace falta acá (barras apiladas,
// una línea/área, una barra segmentada) es chico. Specs de trazo/espaciado siguiendo la guía de
// dataviz interna: barras <=24px con tapa redondeada de 4px, líneas de 2px, gap de 2px entre
// segmentos tocándose, gridlines en gris apenas un paso fuera de la superficie.

export function Sparkline({ values, color = 'var(--color-gold)', className = 'h-8 w-20' }: { values: number[]; color?: string; className?: string }) {
  if (values.length < 2) return <div className={className} />;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${100 - ((v - min) / range) * 100}`).join(' ');
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={className}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function StatTile({ label, value, hint, trend, trendColor }: {
  label: string; value: string; hint?: string; trend?: number[]; trendColor?: string;
}) {
  return (
    <Card className="p-5">
      <div className="text-xs font-bold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1.5 flex items-end justify-between gap-3">
        <div className="font-display text-2xl font-semibold text-ink">{value}</div>
        {trend && trend.length > 1 && <Sparkline values={trend} color={trendColor} />}
      </div>
      {hint && <div className="mt-1.5 text-xs text-muted/80">{hint}</div>}
    </Card>
  );
}

export function ChartCard({ title, subtitle, legend, children }: {
  title: string; subtitle?: string; legend?: { label: string; color: string }[]; children: React.ReactNode;
}) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
        </div>
        {legend && (
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {legend.map((l) => (
              <div key={l.label} className="flex items-center gap-1.5 text-xs font-semibold text-ink/70">
                <span className="h-2 w-2 rounded-full" style={{ background: l.color }} />
                {l.label}
              </div>
            ))}
          </div>
        )}
      </div>
      {children}
    </Card>
  );
}

interface Segment { name: string; value: number; color: string; }
interface BarPoint { key: string; label: string; segments: Segment[]; }

// Barras verticales (una o varias series apiladas) — usada tanto para ingresos (verificado +
// por verificar apilado) como para volumen de reservas (una sola serie).
export function BarChart({ points, formatValue, height = 200 }: {
  points: BarPoint[]; formatValue: (v: number) => string; height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const totals = points.map((p) => p.segments.reduce((s, seg) => s + seg.value, 0));
  const max = Math.max(...totals, 1);
  const gridSteps = [1, 0.5, 0];

  return (
    <div>
      <div className="flex">
        <div className="flex w-14 shrink-0 flex-col justify-between pb-5 pr-2 text-right text-[10px] text-muted" style={{ height }}>
          {gridSteps.map((s) => <span key={s}>{formatValue(max * s)}</span>)}
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="absolute inset-x-0 top-0 flex flex-col justify-between" style={{ height }}>
            {gridSteps.map((s) => <div key={s} className="border-t border-line" />)}
          </div>
          <div className="flex items-end gap-1" style={{ height }}>
            {points.map((p, i) => {
              const total = totals[i];
              const pct = (total / max) * 100;
              return (
                <div
                  key={p.key}
                  className="group relative flex h-full flex-1 justify-center"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover((h) => (h === i ? null : h))}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover((h) => (h === i ? null : h))}
                  tabIndex={0}
                  role="img"
                  aria-label={`${p.label}: ${p.segments.map((s) => `${s.name} ${formatValue(s.value)}`).join(', ')}`}
                >
                  {hover === i && (
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-max max-w-[10rem] -translate-x-1/2 rounded-lg border border-line bg-graphite-900 px-3 py-2 text-xs text-white shadow-lg">
                      <div className="mb-1 font-bold">{p.label}</div>
                      {p.segments.map((s) => (
                        <div key={s.name} className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-1.5 text-graphite-400">
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
                            {s.name}
                          </span>
                          <span className="font-bold tabular-nums">{formatValue(s.value)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div
                    className={`absolute bottom-0 flex w-full max-w-[22px] flex-col-reverse overflow-hidden rounded-t transition-opacity ${hover !== null && hover !== i ? 'opacity-50' : 'opacity-100'}`}
                    style={{ height: total > 0 ? `${Math.max(pct, 1.5)}%` : '0%' }}
                  >
                    {p.segments.map((s) => (
                      <div key={s.name} className="w-full" style={{ height: total > 0 ? `${(s.value / total) * 100}%` : 0, background: s.color, marginBottom: 2 }} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="flex pl-14">
        {points.map((p) => (
          <div key={p.key} className="flex-1 truncate px-0.5 text-center text-[10px] text-muted">{p.label}</div>
        ))}
      </div>
    </div>
  );
}

// Línea + área para UNA sola serie a través del tiempo (ej. % de ocupación por mes) — color
// secuencial único, con crosshair y tooltip al pasar el mouse/foco por cada punto.
export function TrendChart({ points, formatValue, color = 'var(--color-emerald)', height = 180 }: {
  points: { key: string; label: string; value: number }[]; formatValue: (v: number) => string; color?: string; height?: number;
}) {
  const gradId = useId();
  const [hover, setHover] = useState<number | null>(null);
  const n = points.length;
  if (n === 0) return <p className="text-sm text-muted">Sin datos en este período.</p>;

  // Todo (puntos, zonas de hover y etiquetas) usa el MISMO centro de celda, (i + 0.5) / n — antes
  // los puntos iban de borde a borde (i / (n-1)) mientras hover y etiquetas eran celdas iguales,
  // así que el cursor, el tooltip y la etiqueta quedaban corridos respecto del dato real.
  const dataMax = Math.max(...points.map((p) => p.value), 0);
  const max = dataMax > 0 ? dataMax : 1;
  const W = 100;
  const H = 100;
  const coords = points.map((p, i) => ({ x: ((i + 0.5) / n) * W, y: H - (Math.max(p.value, 0) / max) * H }));
  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
  const areaPath = `${linePath} L ${coords[n - 1].x} ${H} L ${coords[0].x} ${H} Z`;
  // Con muchos puntos (ej. 30 días de tráfico) las etiquetas no caben todas: se muestra una de cada
  // `labelStep`, sin truncar ninguna.
  const labelStep = Math.max(1, Math.ceil(n / 6));
  const showDots = n <= 15;

  return (
    <div>
      <div className="flex">
        <div className="flex w-14 shrink-0 flex-col justify-between pr-2 text-right text-[10px] text-muted" style={{ height }}>
          {[1, 0.5, 0].map((s) => <span key={s}>{formatValue(max * s)}</span>)}
        </div>
        <div className="relative min-w-0 flex-1" style={{ height }}>
          {/* Solo la línea/área/rejilla van en SVG estirado (preserveAspectRatio none) — los
              marcadores son HTML para que no se deformen en elipse al estirar el ancho. */}
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full overflow-visible">
            {[0, 0.5, 1].map((s) => (
              <line key={s} x1={0} x2={W} y1={H * (1 - s)} y2={H * (1 - s)} stroke="var(--color-line)" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
            ))}
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.22} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            {n > 1 && <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />}
            {n > 1 && <path d={linePath} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />}
          </svg>
          {hover != null && (
            <div className="pointer-events-none absolute top-0 bottom-0 w-px bg-graphite-400/60" style={{ left: `${coords[hover].x}%` }} />
          )}
          {coords.map((c, i) => {
            const active = hover === i;
            if (!showDots && !active) return null;
            const size = active ? 14 : n === 1 ? 14 : 9;
            return (
              <span
                key={points[i].key}
                className="pointer-events-none absolute rounded-full"
                style={{ left: `${c.x}%`, top: `${c.y}%`, width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2, background: color, border: '2px solid var(--color-card)', boxSizing: 'border-box' }}
              />
            );
          })}
          <div className="absolute inset-0 flex">
            {points.map((p, i) => {
              // Tooltip pegado al borde en los extremos para que no se salga de la tarjeta.
              const edge = i < n * 0.15 ? 'left' : i >= n * 0.85 ? 'right' : 'center';
              return (
                <div
                  key={p.key}
                  className="relative h-full flex-1"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover((h) => (h === i ? null : h))}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover((h) => (h === i ? null : h))}
                  tabIndex={0}
                  role="img"
                  aria-label={`${p.label}: ${formatValue(p.value)}`}
                >
                  {hover === i && (
                    <div
                      className={`pointer-events-none absolute z-10 w-max rounded-lg border border-line bg-graphite-900 px-3 py-1.5 text-xs text-white shadow-lg ${
                        edge === 'left' ? 'left-0' : edge === 'right' ? 'right-0' : 'left-1/2 -translate-x-1/2'
                      }`}
                      style={{ top: `${Math.max(coords[i].y - 22, 0)}%` }}
                    >
                      <span className="font-bold text-graphite-400">{p.label}</span>{' '}
                      <span className="font-bold tabular-nums">{formatValue(p.value)}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="flex pl-14 pt-1">
        {points.map((p, i) => (
          <div key={p.key} className="relative h-4 min-w-0 flex-1">
            {i % labelStep === 0 && (
              <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-muted">{p.label}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Barra horizontal de reparto (part-to-whole) — para desgloses de estado (pendiente/confirmada/
// rechazada/...), reutilizando los mismos colores "reservados" de StatusBadge en vez de
// inventar una paleta categórica nueva para lo que ya son esos mismos estados.
export function SegmentedBar({ segments, formatValue }: { segments: { name: string; value: number; color: string }[]; formatValue: (v: number) => string }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const [hover, setHover] = useState<number | null>(null);
  if (total === 0) return <p className="text-sm text-muted">Sin datos en este período.</p>;

  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-paper-2">
        {segments.filter((s) => s.value > 0).map((s, i) => (
          <div
            key={s.name}
            className="h-full transition-opacity"
            style={{ width: `${(s.value / total) * 100}%`, background: s.color, opacity: hover !== null && hover !== i ? 0.5 : 1, marginRight: i < segments.length - 1 ? 2 : 0 }}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {segments.map((s) => (
          <div key={s.name} className="flex items-center gap-1.5 text-xs">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
            <span className="font-semibold text-ink/80">{s.name}</span>
            <span className="text-muted">{formatValue(s.value)} · {total > 0 ? Math.round((s.value / total) * 100) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Meter({ value, tone = 'var(--color-emerald)' }: { value: number; tone?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-paper-2">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: tone }} />
    </div>
  );
}
