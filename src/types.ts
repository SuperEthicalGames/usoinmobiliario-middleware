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

// Un ambiente del apartamento (sala, cocina, baño...) — POR UNIDAD, no por categoría (decisión
// 2026-09-13: dos apartamentos "estudio" son distribuciones reales distintas, un modelo
// compartido no sirve para describirlas). img/thumb son URLs completas (Cloudinary) o, para
// unidades más viejas, una ruta relativa `media/...` — ver isSafeMediaUrl en firebase.js, que
// es quien realmente valida esto server-side.
export interface Room {
  slug: string;
  img: string;
  thumb: string;
  area: string; // texto libre, ej. "14 m² aprox."
  name: BilingualText;
  tag: BilingualText;
  blurb: BilingualText;
  features: BilingualText[];
}

export interface Apartment {
  _key: string;
  typeKey: string;
  num: string;
  status: OperationalStatus; // campo crudo, control manual del admin
  effectiveStatus?: OperationalStatus; // solo en /apartments — status crudo salvo que una reserva CONFIRMADA lo anule
  isVisible?: boolean; // ausente = true (compatibilidad con unidades ya existentes) — false la saca del catálogo público, nunca del panel
  area: number;
  maxPersons: number;
  baths: number;
  beds: string[];
  feature?: BilingualText;
  rates?: Rates;
  rooms?: Room[]; // fotos/descripciones de esta unidad — ausente/[] = "fotos próximamente" en el sitio
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
  // Calculado por el backend (ver whatsapp-assistant/src/adminRoutes.js: attachPriceCheck),
  // nunca escrito por el cliente — el sitio web calcula estTotal en el navegador y lo manda
  // directo a Firebase, así que esta es la única verificación real contra las tarifas
  // vigentes. Ausente cuando no aplica (citas, o reservas sin tarifas publicadas).
  priceCheck?: { expectedTotal: number; reportedTotal: number; matchesReported: boolean };
  expiresAt?: number;
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  paymentReport?: PaymentReport;
  // Solo cita
  visitDate?: string;
  visitTime?: string;
  appointmentType?: AppointmentType;
  // Marca de hora REAL de llegada/salida — distinto de checkin/checkout (esos son las fechas
  // planeadas). Solo aplica a reservas confirmadas; null/undefined hasta que se registre.
  actualCheckinAt?: string | null;
  actualCheckoutAt?: string | null;
}

export type ContractStatus = 'activo' | 'finalizado' | 'cancelado';
export type PaymentTerm = 'semanal' | 'quincenal' | 'mensual';
export type ContractPaymentMethod = 'transferencia' | 'efectivo' | 'otro';

export interface ContractTenant {
  name: string;
  documentId: string;
  phone?: string;
  email?: string;
}
export interface ContractJointDebtor {
  name: string;
  documentId: string;
}
// Un abono NO se limita a transferencia/efectivo — puede incluir una comisión del programa de
// referidos ("invita y gana") o cualquier otro acuerdo con el dueño (ej. algo vendido que se
// abonó como pago de arriendo), por eso 'otro' con descripción libre. Mismo patrón que ya usa el
// recibo real: dos líneas (transferencia + efectivo) dentro de un mismo abono.
export interface ContractPaymentLine {
  method: ContractPaymentMethod;
  amount: number;
  description?: string;
}
export interface ContractPayment {
  receiptNumber: number;
  date: string;
  periodStart: string;
  periodEnd: string;
  lines: ContractPaymentLine[];
  balanceAfter: number;
}
export interface Contract {
  code: string;
  unitType: string;
  unitNum: string;
  unitLabel: string;
  roomCode: string;
  tenants: ContractTenant[];
  jointDebtor?: ContractJointDebtor;
  maxOccupancy: number;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  paymentTerm: PaymentTerm;
  depositAmount?: number;
  documentUrl?: string;
  notes?: string;
  status: ContractStatus;
  payments: ContractPayment[];
  createdAt: string;
  createdBy?: string;
}

export type CleaningStatus = 'pendiente' | 'en-progreso' | 'completado';
export interface CleaningTask {
  code: string;
  unitType: string;
  unitNum: string;
  unitLabel: string;
  scheduledDate: string;
  assignedTo?: string;
  relatedReservationCode?: string;
  notes?: string;
  status: CleaningStatus;
  createdAt: string;
  completedAt?: string | null;
}

export type MaintenancePriority = 'baja' | 'media' | 'alta';
export type MaintenanceStatus = 'abierto' | 'en-progreso' | 'resuelto';
export interface MaintenanceTicket {
  code: string;
  unitType: string;
  unitNum: string;
  unitLabel: string;
  title: string;
  description?: string;
  priority: MaintenancePriority;
  assignedTo?: string;
  status: MaintenanceStatus;
  reportedBy?: string;
  createdAt: string;
  resolvedAt?: string | null;
}

export interface SiteTrafficDay {
  day: string;
  total: number;
  paths: Record<string, number>;
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
  apartmentsNeedingRealPhotos: number;
  pendingCashPayments: number;
  cleaningPending: number;
  maintenanceOpen: number;
  contractsExpiringSoon: number;
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

// catLabel es el nombre real que ya usa el sitio público (index.html) — "Amoblado 1 Ambiente" /
// "Amoblado 2 Ambientes" — nunca se inventa una traducción nueva de "estudio"/"dos" acá.
// Puramente navegación/agrupación (los filtros de categoría en Apartamentos) — sin editor
// propio, las fotos/descripciones ahora viven en Apartment.rooms (por unidad).
export interface Category {
  catLabel: BilingualText;
  name: BilingualText;
  shortName?: BilingualText;
  blurb?: BilingualText;
}
export type Categories = Record<string, Category>;

// OWNER es siempre config.superAdminEmail en el backend (nunca un dato asignable) — ADMIN y
// EMPLOYEE son cuentas de Firebase Auth con un documento en roles/{uid} (ver adminAuth.js).
export type Role = 'owner' | 'admin' | 'employee';

export interface MeInfo {
  uid: string;
  email: string;
  role: Role;
  isSuperAdmin: boolean;
}

export interface AdminUser {
  uid: string;
  email: string | null;
  role: Role;
  disabled: boolean;
  createdAt: string;
  lastSignInAt: string | null;
}

// Proyección mínima de un empleado, para poblar el selector "asignar a" en Aseo/Mantenimiento —
// distinto de AdminUser (que trae metadata sensible y solo lo devuelve /users, owner-only).
export interface EmployeeOption {
  uid: string;
  email: string | null;
}

export interface Notification {
  id: string;
  type: 'cleaning' | 'maintenance' | 'reservation' | 'payment' | 'system';
  message: string;
  targetCode: string | null;
  read: boolean;
  createdAt: string;
}

// Espejo de fb.logAdminAction/listAuditLog (whatsapp-assistant/src/firebase.js) — una entrada
// por cada acción administrativa que cambia estado real (confirmar/rechazar/cancelar reservas,
// verificar pagos, crear/revocar admins, editar datos bancarios, etc.).
// Derivado en el backend del prefijo de `action` (ver firebase.js: domainForAction) — separa
// reservas/financiero/apartamentos/admin/operaciones (secciones 18-19 del pedido) sin dos
// árboles de auditoría distintos. Entradas viejas (antes de este campo) no lo traen — AuditLog.tsx
// las trata como 'other', nunca se reescriben.
export type AuditDomain = 'reservation' | 'financial' | 'apartment' | 'admin' | 'operations' | 'other';

export interface AuditLogEntry {
  id: string;
  actorUid: string | null;
  actorEmail: string | null;
  action: string;
  domain?: AuditDomain;
  target: string | null;
  metadata: Record<string, unknown> | null;
  timestamp: number;
}
