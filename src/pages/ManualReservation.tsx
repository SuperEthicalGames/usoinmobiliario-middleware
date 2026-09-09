import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api';
import type { Apartment, ReservationRecord } from '../types';
import { Button, Card, PageHeader, fmtCOP } from '../components/ui';

const ERROR_MESSAGES: Record<string, string> = {
  'dates-taken': 'Esas fechas ya no están disponibles para esta unidad.',
  'apartment-not-found': 'No existe ese apartamento.',
  invalid: 'Revisa los campos marcados — falta información.',
};

export function ManualReservation() {
  const navigate = useNavigate();
  const [apartments, setApartments] = useState<Apartment[] | null>(null);
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

  useEffect(() => {
    api.getApartments().then((apts) => setApartments(apts.filter((a) => a.status === 'disponible')));
  }, []);

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
        setError(ERROR_MESSAGES[err.code] ?? `No se pudo crear la reserva (${err.code}).`);
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
        <Card className="max-w-md p-6 text-center">
          <div className="text-xs uppercase tracking-wide text-ink/50">Código</div>
          <div className="font-display text-4xl font-bold tracking-widest text-forest">{created.code}</div>
          <p className="mt-4 text-sm text-ink/70">
            Nace en estado <b>pendiente</b> con un HOLD de 15 minutos, igual que cualquier reserva del sitio o del bot —
            confírmala desde Reservas cuando corresponda.
          </p>
          <div className="mt-6 flex justify-center gap-3">
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
      <form onSubmit={onSubmit} className="max-w-xl space-y-4">
        <Card className="space-y-4 p-6">
          <label className="block text-sm">
            <span className="mb-1 block font-bold text-ink/80">Apartamento</span>
            <select
              required value={selectedKey} onChange={(e) => setSelectedKey(e.target.value)}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2 outline-none focus:border-clay"
            >
              <option value="">Selecciona un apartamento disponible...</option>
              {apartments?.map((a) => (
                <option key={a._key} value={a._key}>Apartamento H{a.num} ({a.typeKey}, {a.maxPersons} huésp.)</option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="block text-sm">
              <span className="mb-1 block font-bold text-ink/80">Check-in</span>
              <input type="date" required value={checkin} onChange={(e) => setCheckin(e.target.value)}
                className="w-full rounded-lg border border-line bg-paper px-3 py-2 outline-none focus:border-clay" />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-bold text-ink/80">Check-out</span>
              <input type="date" required value={checkout} onChange={(e) => setCheckout(e.target.value)}
                className="w-full rounded-lg border border-line bg-paper px-3 py-2 outline-none focus:border-clay" />
            </label>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block font-bold text-ink/80">Huéspedes</span>
            <input type="number" min={1} max={selected?.maxPersons ?? 10} required value={guests}
              onChange={(e) => setGuests(Number(e.target.value))}
              className="w-32 rounded-lg border border-line bg-paper px-3 py-2 outline-none focus:border-clay" />
          </label>

          {selected?.rates?.month != null && (
            <p className="text-xs text-ink/50">Tarifa mensual de referencia: {fmtCOP(selected.rates.month)}. El total real se calcula al crear la reserva.</p>
          )}
        </Card>

        <Card className="space-y-4 p-6">
          <label className="block text-sm">
            <span className="mb-1 block font-bold text-ink/80">Nombre</span>
            <input required value={name} onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2 outline-none focus:border-clay" />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block text-sm">
              <span className="mb-1 block font-bold text-ink/80">Teléfono</span>
              <input required value={phone} onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-line bg-paper px-3 py-2 outline-none focus:border-clay" />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-bold text-ink/80">Correo</span>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-line bg-paper px-3 py-2 outline-none focus:border-clay" />
            </label>
          </div>
          <label className="block text-sm">
            <span className="mb-1 block font-bold text-ink/80">Notas (opcional)</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2 outline-none focus:border-clay" />
          </label>
        </Card>

        {error && (
          <p className="text-sm text-clay">
            {error}{missingFields.length > 0 && ` (${missingFields.join(', ')})`}
          </p>
        )}

        <Button type="submit" disabled={submitting || !selected}>
          {submitting ? 'Creando...' : 'Crear reserva'}
        </Button>
      </form>
    </div>
  );
}
