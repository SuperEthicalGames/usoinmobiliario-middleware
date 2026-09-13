import { useEffect, useState } from 'react';
import type { Apartment, OperationalStatus } from '../types';
import { api, describeApiError } from '../api';
import { Button, Field, Select } from './ui';
import { CloseIcon } from './icons';

// Mismo patrón de panel deslizante que RecordDetail.tsx — un solo lenguaje visual para "abrir
// el detalle de algo" en todo el panel.
const STATUS_OPTIONS: { value: OperationalStatus; label: string }[] = [
  { value: 'disponible', label: 'Disponible' },
  { value: 'en-uso', label: 'En uso' },
  { value: 'reservado', label: 'Reservado' },
];

// Formulario controlado con strings (inputs de texto/número) — se convierte a los tipos reales
// recién al enviar, igual que el resto de formularios del panel (ver ManualReservation.tsx).
//
// Las tarifas eran 4 Field de texto separados por coma ("100000, 85000, 75000, 75000") — nada
// que ver con cómo se ven en el sitio real (tabla 3 filas × 4 columnas, index.html:4150-4157).
// Un RateRow es esa misma fila: una celda de texto por columna (1 noche / 2-6 noches / semanal
// / mensual-por-noche), así la grilla de acá abajo es un <table> real, no CSV a ciegas — y de
// paso se acaba un bug latente del formato CSV: una celda vacía en medio de la lista
// (".map(Number)" contra un array ya filtrado) corría el resto de los valores una posición.
type RateRow = [string, string, string, string];
const RATE_COLS = ['1 noche', '2-6 noches', 'Semanal', 'Mensual/noche'] as const;
function toRateRow(arr?: number[]): RateRow {
  return [0, 1, 2, 3].map((i) => (arr && arr[i] != null ? String(arr[i]) : '')) as RateRow;
}
// undefined = fila nunca tocada (ninguna celda tiene valor) => no mandar esa tarifa, igual que
// antes cuando el CSV completo venía vacío. Si al menos una celda tiene valor, las vacías se
// mandan como 0 (tarifa "gratis" explícita) en vez de desalinear el array.
function rateRowToArray(row: RateRow): number[] | undefined {
  if (row.every((c) => c.trim() === '')) return undefined;
  return row.map((c) => Number(c) || 0);
}

interface FormState {
  status: OperationalStatus;
  isVisible: boolean;
  area: string;
  maxPersons: string;
  baths: string;
  beds: string; // separado por comas en la UI, array en el modelo
  featureEs: string;
  featureEn: string;
  rateOne: RateRow;
  rateTwo: RateRow;
  rateExtra: RateRow;
  rateMonth: string;
  promo: boolean;
  flagship: boolean;
}

function toForm(apt: Apartment): FormState {
  return {
    status: apt.status,
    isVisible: apt.isVisible !== false,
    area: String(apt.area ?? ''),
    maxPersons: String(apt.maxPersons ?? ''),
    baths: String(apt.baths ?? ''),
    beds: (apt.beds ?? []).join(', '),
    featureEs: apt.feature?.es ?? '',
    featureEn: apt.feature?.en ?? '',
    rateOne: toRateRow(apt.rates?.one),
    rateTwo: toRateRow(apt.rates?.two),
    rateExtra: toRateRow(apt.rates?.extra),
    rateMonth: apt.rates?.month != null ? String(apt.rates.month) : '',
    promo: !!apt.promo,
    flagship: !!apt.flagship,
  };
}

function toPatch(f: FormState): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    status: f.status,
    isVisible: f.isVisible,
    area: Number(f.area) || 0,
    maxPersons: Number(f.maxPersons) || 1,
    baths: Number(f.baths) || 1,
    beds: f.beds.split(',').map((x) => x.trim()).filter(Boolean),
    feature: { es: f.featureEs.trim(), en: f.featureEn.trim() },
    promo: f.promo,
    flagship: f.flagship,
  };
  const rates: Record<string, unknown> = {};
  const one = rateRowToArray(f.rateOne); if (one) rates.one = one;
  const two = rateRowToArray(f.rateTwo); if (two) rates.two = two;
  const extra = rateRowToArray(f.rateExtra); if (extra) rates.extra = extra;
  if (f.rateMonth.trim()) rates.month = Number(f.rateMonth);
  patch.rates = rates;
  return patch;
}

export function ApartmentEditor({ apartment, onClose, onSaved }: {
  apartment: Apartment;
  onClose: () => void;
  onSaved: (updated: Apartment) => void;
}) {
  const [form, setForm] = useState<FormState>(() => toForm(apartment));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setShow(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }
  function setRateCell(row: 'rateOne' | 'rateTwo' | 'rateExtra', idx: number, value: string) {
    setForm((prev) => {
      const next = [...prev[row]] as RateRow;
      next[idx] = value;
      return { ...prev, [row]: next };
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateApartment(apartment.typeKey, apartment.num, toPatch(form));
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-end bg-graphite-950/50 transition-opacity duration-200 ${show ? 'opacity-100' : 'opacity-0'}`}
      onClick={onClose}
    >
      <div
        className={`h-full w-full max-w-lg overflow-y-auto bg-card p-6 shadow-2xl transition-transform duration-200 ease-out ${show ? 'translate-x-0' : 'translate-x-full'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <div className="font-display text-xl font-semibold text-ink">Apartamento H{apartment.num}</div>
            <div className="mt-1 text-xs text-muted">{apartment.typeKey} · {apartment._key}</div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted transition hover:bg-paper-2 hover:text-ink" aria-label="Cerrar">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Select label="Estado operativo" value={form.status} onChange={(e) => set('status', e.target.value as OperationalStatus)}>
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
            <label className="flex flex-col justify-end pb-1.5">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">Visibilidad</span>
              <span className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isVisible} onChange={(e) => set('isVisible', e.target.checked)} className="h-4 w-4" />
                {form.isVisible ? 'Visible en el catálogo público' : 'Oculto del catálogo público'}
              </span>
            </label>
          </div>
          <p className="-mt-2 text-xs text-muted">
            El estado operativo se recalcula solo contra reservas reales cuando corresponde (ver la tarjeta en Apartamentos) — este campo manual solo importa cuando no hay ninguna reserva activa que lo anule.
          </p>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Área (m²)" type="number" value={form.area} onChange={(e) => set('area', e.target.value)} />
            <Field label="Capacidad" type="number" value={form.maxPersons} onChange={(e) => set('maxPersons', e.target.value)} />
            <Field label="Baños" type="number" value={form.baths} onChange={(e) => set('baths', e.target.value)} />
          </div>
          <Field label="Camas (separadas por coma)" value={form.beds} onChange={(e) => set('beds', e.target.value)} placeholder="1 doble, 2 sencillas" />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Característica destacada (ES)" value={form.featureEs} onChange={(e) => set('featureEs', e.target.value)} />
            <Field label="Featured highlight (EN)" value={form.featureEn} onChange={(e) => set('featureEn', e.target.value)} />
          </div>

          <div className="border-t border-line pt-4">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Tarifas (COP)</h3>
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="bg-paper-2 text-left text-xs font-bold uppercase tracking-wide text-muted">
                    <th className="px-3 py-2">Estadía</th>
                    {RATE_COLS.map((c) => <th key={c} className="px-2 py-2 text-right">{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {([
                    ['1 huésped', 'rateOne', form.rateOne],
                    ['2+ huéspedes', 'rateTwo', form.rateTwo],
                    ['Huésped extra', 'rateExtra', form.rateExtra],
                  ] as const).map(([label, key, row]) => (
                    <tr key={key} className="border-t border-line">
                      <td className="whitespace-nowrap px-2 py-1.5 font-semibold text-ink/80">{label}</td>
                      {row.map((cell, i) => (
                        <td key={i} className="px-1 py-1.5">
                          <input
                            type="number"
                            value={cell}
                            onChange={(e) => setRateCell(key, i, e.target.value)}
                            className="w-full min-w-0 [appearance:textfield] rounded-lg border border-line bg-paper px-1.5 py-1.5 text-right text-[13px] outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/15 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-1.5 text-xs text-muted">Deja una fila completamente vacía si esa estadía todavía no tiene tarifa publicada.</p>
            <Field label="Mensual (valor total, el precio destacado en la tarjeta)" type="number" value={form.rateMonth} onChange={(e) => set('rateMonth', e.target.value)} className="mt-3 max-w-xs" />
          </div>

          <div className="flex gap-6 border-t border-line pt-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.promo} onChange={(e) => set('promo', e.target.checked)} className="h-4 w-4" />
              En promoción
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.flagship} onChange={(e) => set('flagship', e.target.checked)} className="h-4 w-4" />
              Destacado (flagship)
            </label>
          </div>

          {error && <p className="rounded-xl bg-red/10 px-3.5 py-2.5 text-sm text-red-dark">{error}</p>}

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button disabled={saving} onClick={save}>{saving ? 'Guardando...' : 'Guardar cambios'}</Button>
          </div>
          <p className="text-xs text-muted">
            No se editan fotos ni el recorrido 360° desde acá — esos siguen viviendo como archivos en <code>media/</code> del sitio público, fuera de Firebase por diseño del proyecto.
          </p>
        </div>
      </div>
    </div>
  );
}
