const RESERVATION_STYLES: Record<string, string> = {
  pendiente: 'bg-ochre/15 text-ochre',
  confirmada: 'bg-forest/15 text-forest',
  rechazada: 'bg-clay/15 text-clay',
  cancelada: 'bg-ink/10 text-ink/60',
  completada: 'bg-forest/25 text-forest-dk',
};

const PAYMENT_STYLES: Record<string, string> = {
  none: 'bg-ink/10 text-ink/50',
  submitted: 'bg-ochre/15 text-ochre',
  verified: 'bg-forest/15 text-forest',
  rejected: 'bg-clay/15 text-clay',
};

const RESERVATION_LABELS: Record<string, string> = {
  pendiente: 'Pendiente', confirmada: 'Confirmada', rechazada: 'Rechazada',
  cancelada: 'Cancelada', completada: 'Completada',
};
const PAYMENT_LABELS: Record<string, string> = {
  none: 'Sin pago', submitted: 'Reportado', verified: 'Verificado', rejected: 'Rechazado',
};

function Pill({ className, children }: { className: string; children: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold tracking-wide ${className}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return <Pill className={RESERVATION_STYLES[status] ?? 'bg-ink/10 text-ink/60'}>{RESERVATION_LABELS[status] ?? status}</Pill>;
}

export function PaymentBadge({ status }: { status: string }) {
  return <Pill className={PAYMENT_STYLES[status] ?? 'bg-ink/10 text-ink/60'}>{PAYMENT_LABELS[status] ?? status}</Pill>;
}

export function TypeBadge({ type }: { type: 'reserva' | 'cita' }) {
  return type === 'reserva'
    ? <Pill className="bg-forest/15 text-forest">Reserva</Pill>
    : <Pill className="bg-clay/15 text-clay">Visita</Pill>;
}
