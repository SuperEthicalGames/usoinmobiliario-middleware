// Espejo a mano de las formas que devuelve whatsapp-assistant/src/adminRoutes.js (mismo
// backend del repo D:\Portfolio\UsoInmobiliario) — sin paquete npm compartido entre los dos
// repos, desproporcionado para un solo consumidor (ver plan). Si un campo cambia del lado del
// backend, hay que actualizar esto a mano — mismo criterio ya aceptado en ese proyecto para
// constantes repetidas como HOLD_DURATION_MS.

export interface BilingualText {
  es: string;
  en: string;
}

export interface Rates {
  one?: number[]; // [1 noche, 2-6 noches, semanal, mensual] — tarifa POR NOCHE de ese tramo
  two?: number[];
  extra?: number[];
  month?: number;
}

export type OperationalStatus = 'disponible' | 'en-uso' | 'reservado';

export interface Apartment {
  _key: string;
  typeKey: string;
  num: string;
  status: OperationalStatus; // campo crudo, control manual del admin
  effectiveStatus?: OperationalStatus; // solo en /apartments — status crudo salvo que una reserva CONFIRMADA lo anule
  area: number;
  maxPersons: number;
  baths: number;
  beds: string[];
  feature?: BilingualText;
  rates?: Rates;
  promo?: boolean;
  flagship?: boolean;
}

export type ReservationStatus = 'pendiente' | 'confirmada' | 'rechazada' | 'cancelada' | 'completada';
export type PaymentStatus = 'none' | 'submitted' | 'verified' | 'rejected';
export type PaymentMethod = 'bank_transfer' | 'cash';
export type AppointmentType = 'specific_visit' | 'general_visit';

export interface PriceSnapshot {
  tier: string;
  nights: number;
  guests: number;
  baseRate: number;
  baseTotal: number;
  extraGuests: number;
  extraRate: number;
  extraTotal: number;
  discountTotal: number;
  total: number;
  currency: string;
}

export interface PaymentReport {
  reference: string;
  date: string;
  amount: number;
  bank: string;
  proofUrl?: string;
  reportedAt: string;
}

// Un solo tipo para reservas Y citas (mismo criterio que el backend: un registro, discriminado
// por `type`) — evita una jerarquía paralela que Firebase tampoco tiene.
export interface ReservationRecord {
  code: string;
  type: 'reserva' | 'cita';
  createdAt: string;
  unitType?: string;
  unitNum?: string;
  unitLabel: string;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  status: ReservationStatus;
  // Solo reserva
  checkin?: string;
  checkout?: string;
  nights?: number;
  guests?: number;
  estTotal?: number;
  priceSnapshot?: PriceSnapshot;
  expiresAt?: number;
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  paymentReport?: PaymentReport;
  // Solo cita
  visitDate?: string;
  visitTime?: string;
  appointmentType?: AppointmentType;
}

export interface DashboardSummary {
  availableCount: number;
  inUseCount: number;
  reservedCount: number;
  pendingReservations: number;
  confirmedReservations: number;
  activeHolds: number;
  pendingPaymentVerifications: number;
  upcomingVisits: ReservationRecord[];
}

export interface PaymentInfo {
  bankName: string;
  accountHolder: string;
  accountType: string;
  accountNumber: string | number;
}

export type RecordAction = 'confirm' | 'reject' | 'cancel' | 'complete';

export interface ManualReservationInput {
  typeKey: string;
  num: string;
  checkin: string;
  checkout: string;
  guests: number;
  name: string;
  phone: string;
  email: string;
  notes?: string;
}

export interface ApiErrorBody {
  error: string;
  missingFields?: string[];
}
