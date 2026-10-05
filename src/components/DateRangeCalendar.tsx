import { useMemo, useState } from 'react';
import { ChevronRightIcon } from './icons';

// Calendario de rango propio (sin librería): un clic marca el inicio, el segundo el fin. Las
// fechas son "YYYY-MM-DD" puras, igual que el resto del panel — nunca pasan por zona horaria.
export interface DateRange { from: string | null; to: string | null; }

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

export function DateRangeCalendar({ value, onChange, today }: { value: DateRange; onChange: (r: DateRange) => void; today: string }) {
  const anchor = value.from ?? today;
  const [view, setView] = useState({ y: Number(anchor.slice(0, 4)), m: Number(anchor.slice(5, 7)) - 1 });
  const [hover, setHover] = useState<string | null>(null);

  const cells = useMemo(() => {
    const firstDow = (new Date(Date.UTC(view.y, view.m, 1)).getUTCDay() + 6) % 7; // lunes = 0
    const days = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
    return [...Array(firstDow).fill(null), ...Array.from({ length: days }, (_, i) => iso(view.y, view.m, i + 1))] as (string | null)[];
  }, [view]);

  function shift(delta: number) {
    const d = new Date(Date.UTC(view.y, view.m + delta, 1));
    setView({ y: d.getUTCFullYear(), m: d.getUTCMonth() });
  }

  function pick(day: string) {
    // Sin rango, o rango ya completo → empieza uno nuevo; con inicio solo → cierra (ordenando).
    if (!value.from || value.to) onChange({ from: day, to: null });
    else onChange(day < value.from ? { from: day, to: value.from } : { from: value.from, to: day });
  }

  const monthName = new Date(Date.UTC(view.y, view.m, 1)).toLocaleDateString('es-CO', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  // Mientras falta el fin, el rango "tentativo" sigue al mouse.
  const previewEnd = !value.to && value.from && hover ? hover : value.to;
  const lo = value.from && previewEnd ? (value.from < previewEnd ? value.from : previewEnd) : value.from;
  const hi = value.from && previewEnd ? (value.from < previewEnd ? previewEnd : value.from) : value.from;

  return (
    <div className="w-full max-w-sm select-none">
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={() => shift(-1)} aria-label="Mes anterior" className="rounded-lg p-2 text-ink/70 hover:bg-paper-2">
          <ChevronRightIcon className="h-5 w-5 rotate-180" />
        </button>
        <div className="font-display text-base font-semibold capitalize text-ink" aria-live="polite">{monthName}</div>
        <button type="button" onClick={() => shift(1)} aria-label="Mes siguiente" className="rounded-lg p-2 text-ink/70 hover:bg-paper-2">
          <ChevronRightIcon className="h-5 w-5" />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] font-bold uppercase text-muted">
        {WEEKDAYS.map((w) => <div key={w} className="py-1.5">{w}</div>)}
      </div>
      <div className="grid grid-cols-7" onMouseLeave={() => setHover(null)}>
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />;
          const isEdge = day === value.from || day === value.to;
          const inRange = lo && hi && day >= lo && day <= hi;
          return (
            <button
              key={day}
              type="button"
              onClick={() => pick(day)}
              onMouseEnter={() => setHover(day)}
              aria-pressed={isEdge}
              aria-label={new Date(day + 'T00:00:00Z').toLocaleDateString('es-CO', { dateStyle: 'full', timeZone: 'UTC' })}
              className={`relative h-10 text-sm font-semibold transition focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${
                isEdge ? 'rounded-full bg-graphite-900 text-white'
                  : inRange ? 'bg-gold/20 text-ink'
                    : 'rounded-full text-ink hover:bg-paper-2'
              } ${day === today && !isEdge ? 'ring-1 ring-gold' : ''}`}
            >
              {Number(day.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
