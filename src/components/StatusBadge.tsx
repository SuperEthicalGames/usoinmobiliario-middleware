type Tone = 'emerald' | 'amber' | 'red' | 'graphite' | 'gold';

const TONE_CLASSES: Record<Tone, { tint: string; text: string; solid: string }> = {
  emerald: { tint: 'bg-emerald/10', text: 'text-emerald-dark', solid: 'bg-emerald' },
  amber: { tint: 'bg-amber/10', text: 'text-amber-dark', solid: 'bg-amber' },
  red: { tint: 'bg-red/10', text: 'text-red-dark', solid: 'bg-red' },
  graphite: { tint: 'bg-graphite-400/15', text: 'text-graphite-600', solid: 'bg-graphite-600' },
  gold: { tint: 'bg-gold/10', text: 'text-gold-dark', solid: 'bg-gold' },
};

// Pill "sólido" (relleno, texto blanco) para estados FINALES — completada, la reserva/cita ya
// no cambia — vs. "tenue" (fondo tintado) para estados vigentes/en curso, para que un vistazo
// rápido a una lista distinga "esto ya terminó" de "esto sigue activo" sin leer el texto.
function Pill({ tone, solid, children }: { tone: Tone; solid?: boolean; children: string }) {
  const c = TONE_CLASSES[tone];
  if (solid) {
    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold tracking-wide text-white ${c.solid}`}>
        {children}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold tracking-wide ${c.tint} ${c.text}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${c.solid}`} />
      {children}
    </span>
  );
}

const RESERVATION_TONE: Record<string, Tone> = {
  pendiente: 'amber',
  confirmada: 'emerald',
  rechazada: 'red',
  cancelada: 'graphite',
  completada: 'emerald',
};
const PAYMENT_TONE: Record<string, Tone> = {
  none: 'graphite',
  submitted: 'amber',
  verified: 'emerald',
  rejected: 'red',
};
// BUG REAL (encontrado al redisear): Apartments.tsx le pasaba 'disponible'/'en-uso'/'reservado'
// a este mismo StatusBadge, pensado solo para el vocabulario de ReservationStatus — como
// ninguna de esas claves existía acá, las tres siempre caían al gris genérico por defecto y
// las tarjetas de apartamentos nunca mostraban el color de estado. Vocabulario aparte
// (OperationalStatus), badge aparte.
const OPERATIONAL_TONE: Record<string, Tone> = {
  disponible: 'emerald',
  'en-uso': 'amber',
  reservado: 'gold',
};

const RESERVATION_LABELS: Record<string, string> = {
  pendiente: 'Pendiente', confirmada: 'Confirmada', rechazada: 'Rechazada',
  cancelada: 'Cancelada', completada: 'Completada',
};
const PAYMENT_LABELS: Record<string, string> = {
  none: 'Sin pago', submitted: 'Reportado', verified: 'Verificado', rejected: 'Rechazado',
};
const OPERATIONAL_LABELS: Record<string, string> = {
  disponible: 'Disponible', 'en-uso': 'En uso', reservado: 'Reservado',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Pill tone={RESERVATION_TONE[status] ?? 'graphite'} solid={status === 'completada'}>
      {RESERVATION_LABELS[status] ?? status}
    </Pill>
  );
}

export function PaymentBadge({ status }: { status: string }) {
  return <Pill tone={PAYMENT_TONE[status] ?? 'graphite'}>{PAYMENT_LABELS[status] ?? status}</Pill>;
}

export function OperationalStatusBadge({ status }: { status: string }) {
  return <Pill tone={OPERATIONAL_TONE[status] ?? 'graphite'}>{OPERATIONAL_LABELS[status] ?? status}</Pill>;
}

export function AdminStatusBadge({ disabled }: { disabled: boolean }) {
  return <Pill tone={disabled ? 'red' : 'emerald'}>{disabled ? 'Revocado' : 'Activo'}</Pill>;
}

const CONTRACT_TONE: Record<string, Tone> = { activo: 'emerald', finalizado: 'graphite', cancelado: 'red' };
const CONTRACT_LABELS: Record<string, string> = { activo: 'Activo', finalizado: 'Finalizado', cancelado: 'Cancelado' };
export function ContractStatusBadge({ status }: { status: string }) {
  return <Pill tone={CONTRACT_TONE[status] ?? 'graphite'} solid={status === 'finalizado'}>{CONTRACT_LABELS[status] ?? status}</Pill>;
}

const CLEANING_TONE: Record<string, Tone> = { pendiente: 'amber', 'en-progreso': 'gold', completado: 'emerald' };
const CLEANING_LABELS: Record<string, string> = { pendiente: 'Pendiente', 'en-progreso': 'En progreso', completado: 'Completado' };
export function CleaningStatusBadge({ status }: { status: string }) {
  return <Pill tone={CLEANING_TONE[status] ?? 'graphite'} solid={status === 'completado'}>{CLEANING_LABELS[status] ?? status}</Pill>;
}

const MAINTENANCE_TONE: Record<string, Tone> = { abierto: 'red', 'en-progreso': 'amber', resuelto: 'emerald' };
const MAINTENANCE_LABELS: Record<string, string> = { abierto: 'Abierto', 'en-progreso': 'En progreso', resuelto: 'Resuelto' };
export function MaintenanceStatusBadge({ status }: { status: string }) {
  return <Pill tone={MAINTENANCE_TONE[status] ?? 'graphite'} solid={status === 'resuelto'}>{MAINTENANCE_LABELS[status] ?? status}</Pill>;
}

const PRIORITY_TONE: Record<string, Tone> = { baja: 'graphite', media: 'amber', alta: 'red' };
const PRIORITY_LABELS: Record<string, string> = { baja: 'Baja', media: 'Media', alta: 'Alta' };
export function PriorityBadge({ priority }: { priority: string }) {
  return <Pill tone={PRIORITY_TONE[priority] ?? 'graphite'}>{PRIORITY_LABELS[priority] ?? priority}</Pill>;
}

export function TypeBadge({ type }: { type: 'reserva' | 'cita' }) {
  return type === 'reserva' ? <Pill tone="gold">Reserva</Pill> : <Pill tone="graphite">Visita</Pill>;
}
