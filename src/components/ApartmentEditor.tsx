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
interface FormState {
  status: OperationalStatus;
  isVisible: boolean;
  area: string;
  maxPersons: string;
  baths: string;
  beds: string; // separado por comas en la UI, array en el modelo
  featureEs: string;
  featureEn: string;
  rateOne: string; // "1noche,2-6,semanal,mensual" separado por comas
  rateTwo: string;
  rateExtra: string;
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
    rateOne: (apt.rates?.one ?? []).join(', '),
    rateTwo: (apt.rates?.two ?? []).join(', '),
    rateExtra: (apt.rates?.extra ?? []).join(', '),
    rateMonth: apt.rates?.month != null ? String(apt.rates.month) : '',
    promo: !!apt.promo,
    flagship: !!apt.flagship,
  };
}

function parseNumberList(s: string): number[] {
  return s.split(',').map((x) => x.trim()).filter(Boolean).map(Number).filter((n) => !Number.isNaN(n));
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
  const one = parseNumberList(f.rateOne); if (one.length) rates.one = one;
  const two = parseNumberList(f.rateTwo); if (two.length) rates.two = two;
  const extra = parseNumberList(f.rateExtra); if (extra.length) rates.extra = extra;
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
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Tarifas (COP, separadas por coma: 1 noche, 2-6 noches, semanal)</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="1 huésped" value={form.rateOne} onChange={(e) => set('rateOne', e.target.value)} placeholder="180000, 160000, 950000" />
              <Field label="2+ huéspedes" value={form.rateTwo} onChange={(e) => set('rateTwo', e.target.value)} placeholder="220000, 200000, 1200000" />
              <Field label="Huésped extra (por noche, por tramo)" value={form.rateExtra} onChange={(e) => set('rateExtra', e.target.value)} placeholder="30000, 25000" />
              <Field label="Mensual" type="number" value={form.rateMonth} onChange={(e) => set('rateMonth', e.target.value)} />
            </div>
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
