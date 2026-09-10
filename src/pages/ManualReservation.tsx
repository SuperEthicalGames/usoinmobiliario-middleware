import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError, describeApiError } from '../api';
import type { Apartment, Categories, ReservationRecord } from '../types';
import { AsyncSection, Button, Card, Field, PageHeader, Select, TextArea, fmtCOP } from '../components/ui';

const ERROR_MESSAGES: Record<string, string> = {
  'dates-taken': 'Esas fechas ya no están disponibles para esta unidad.',
  'apartment-not-found': 'No existe ese apartamento.',
  invalid: 'Revisa los campos marcados — falta información.',
};

export function ManualReservation() {
  const navigate = useNavigate();
  const [apartments, setApartments] = useState<Apartment[] | null>(null);
  const [categories, setCategories] = useState<Categories | null>(null);
  const [loadingApts, setLoadingApts] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState('');
  const [checkin, setCheckin] = useState('');
  const [checkout, setCheckout] = useState('');
  const [guests, setGuests] = useState(1);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [created, setCreated] = useState<ReservationRecord | null>(null);

  // ANTES: sin catch acá — si esta llamada fallaba (por ejemplo el cold-start del backend
  // gratuito en Render), el selector se quedaba vacío para siempre, sin aviso ni forma de
  // reintentar. Bug real, no solo falta de estilo.
  function loadApartments() {
    setLoadingApts(true);
    setLoadError(null);
    Promise.all([api.getApartments(), api.getCategories()])
      .then(([apts, cats]) => {
        // (a.effectiveStatus ?? a.status), NUNCA a.status solo — mismo criterio que Apartments.tsx.
        // Antes filtraba solo por a.status (el campo manual): si una reserva CONFIRMADA ya
        // marcaba el apartamento en-uso/reservado pero nadie había actualizado a mano el campo
        // crudo en Firebase, este selector lo seguía mostrando como "disponible" para armar una
        // reserva manual encima — el backend rechaza el choque real de fechas, pero el selector
        // no debería ni ofrecerlo como opción.
        setApartments(apts.filter((a) => (a.effectiveStatus ?? a.status) === 'disponible'));
        setCategories(cats);
      })
      .catch((err) => setLoadError(describeApiError(err)))
      .finally(() => setLoadingApts(false));
  }
  useEffect(loadApartments, []);

  function categoryLabel(typeKey: string): string {
    return categories?.[typeKey]?.catLabel?.es ?? typeKey;
  }

  const selected = apartments?.find((a) => a._key === selectedKey);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    setMissingFields([]);
    try {
      const rec = await api.createManualReservation({
        typeKey: selected.typeKey, num: selected.num, checkin, checkout, guests,
        name, phone, email, notes: notes || undefined,
      });
      setCreated(rec);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(ERROR_MESSAGES[err.code] ?? describeApiError(err));
        setMissingFields(err.missingFields ?? []);
      } else {
        setError('Ocurrió un error inesperado.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    return (
      <div>
        <PageHeader title="Reserva creada" />
        <Card className="max-w-md p-8 text-center">
          <div className="text-xs font-bold uppercase tracking-wide text-muted">Código</div>
          <div className="font-display text-4xl font-bold tracking-widest text-emerald-dark">{created.code}</div>
          <p className="mt-4 text-sm text-ink/70">
            Nace en estado <b>pendiente</b> con un HOLD de 15 minutos, igual que cualquier reserva del sitio o del bot —
            confírmala desde Reservas cuando corresponda.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button variant="ghost" onClick={() => navigate('/reservas')}>Ver reservas</Button>
            <Button onClick={() => { setCreated(null); setName(''); setPhone(''); setEmail(''); setNotes(''); }}>Crear otra</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Reserva manual" subtitle="A nombre de un cliente — mismo flujo y mismas reglas que una reserva del sitio." />
      <AsyncSection loading={loadingApts} error={loadError} data={apartments} empty="No hay apartamentos disponibles para reservar en este momento." onRetry={loadApartments}>
        {() => (
      <form onSubmit={onSubmit} className="max-w-xl space-y-4">
        <Card className="space-y-4 p-6">
          <Select label="Apartamento" required value={selectedKey} onChange={(e) => setSelectedKey(e.target.value)}>
            <option value="">Selecciona un apartamento disponible...</option>
            {apartments?.map((a) => (
              <option key={a._key} value={a._key}>Apartamento H{a.num} — {categoryLabel(a.typeKey)} ({a.maxPersons} huésp. máx.)</option>
            ))}
          </Select>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Check-in" type="date" required value={checkin} onChange={(e) => setCheckin(e.target.value)} />
            <Field label="Check-out" type="date" required value={checkout} onChange={(e) => setCheckout(e.target.value)} />
          </div>

          <Field
            label="Huéspedes" type="number" min={1} max={selected?.maxPersons ?? 10} required value={guests}
            onChange={(e) => setGuests(Number(e.target.value))} className="max-w-[8rem]"
          />

          {selected?.rates?.month != null && (
            <p className="text-xs text-muted">Tarifa mensual de referencia: {fmtCOP(selected.rates.month)}. El total real se calcula al crear la reserva.</p>
          )}
        </Card>

        <Card className="space-y-4 p-6">
          <Field label="Nombre" required value={name} onChange={(e) => setName(e.target.value)} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Teléfono" required value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Field label="Correo" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <TextArea label="Notas (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </Card>

        {error && (
          <p className="rounded-xl bg-red/10 px-3.5 py-2.5 text-sm text-red-dark">
            {error}{missingFields.length > 0 && ` (${missingFields.join(', ')})`}
          </p>
        )}

        <Button type="submit" disabled={submitting || !selected}>
          {submitting ? 'Creando...' : 'Crear reserva'}
        </Button>
      </form>
        )}
      </AsyncSection>
    </div>
  );
}
