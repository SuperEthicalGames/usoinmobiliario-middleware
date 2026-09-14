import { auth } from './firebase';
import { API_BASE_URL } from './config';
import type {
  Apartment, ReservationRecord, DashboardSummary, PaymentInfo, RecordAction, ManualReservationInput, ApiErrorBody,
  Categories, MeInfo, AdminUser, Role, EmployeeOption, Contract, ContractStatus, ContractPayment, ContractPaymentLine,
  CleaningTask, CleaningStatus, MaintenanceTicket, MaintenanceStatus, SiteTrafficDay, AuditLogEntry, Notification,
} from './types';

export class ApiError extends Error {
  code: string;
  missingFields?: string[];
  constructor(body: ApiErrorBody, status: number) {
    super(body.error || `http-${status}`);
    this.code = body.error || `http-${status}`;
    this.missingFields = body.missingFields;
  }
}

// Pide el token FRESCO en cada llamada (nunca lo cachea en una variable) — el SDK de Firebase
// lo renueva solo, pero solo si de verdad se le vuelve a pedir; cachear el string llevaría a
// pegarle al backend con un token vencido pasada una hora de sesión abierta.
async function authHeader(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) throw new ApiError({ error: 'not-authenticated' }, 401);
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

// El backend vive en el plan gratuito de Render: si nadie lo usó en un rato, la primera
// petición puede tardar 20-30s en lo que el servicio despierta. Sin un timeout explícito, esa
// espera se ve exactamente igual que un panel colgado — con él, se puede distinguir y avisar
// ("el servidor puede estar despertando") en vez de dejar un spinner sin explicación.
const TIMEOUT_MS = 30000;

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = { 'Content-Type': 'application/json', ...(await authHeader()), ...(options.headers || {}) };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, cache: 'no-store', signal: controller.signal });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw new ApiError({ error: 'timeout' }, 0);
    throw new ApiError({ error: 'network-error' }, 0);
  } finally {
    clearTimeout(timeout);
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body as ApiErrorBody, res.status);
  return body as T;
}

export const api = {
  getMe: () => request<MeInfo>('/me'),
  getDashboard: () => request<DashboardSummary>('/dashboard'),
  getApartments: () => request<Apartment[]>('/apartments'),
  updateApartment: (typeKey: string, num: string, patch: Record<string, unknown>) =>
    request<Apartment>(`/apartments/${typeKey}/${num}`, { method: 'PUT', body: JSON.stringify(patch) }),
  createApartment: (typeKey: string, num: string, data: Record<string, unknown>) =>
    request<Apartment>('/apartments', { method: 'POST', body: JSON.stringify({ typeKey, num, ...data }) }),
  getCategories: () => request<Categories>('/categories'),
  getReservations: () => request<ReservationRecord[]>('/reservations'),
  getVisits: () => request<ReservationRecord[]>('/visits'),
  getRecord: (code: string) => request<ReservationRecord>(`/records/${code}`),
  getPaymentInfo: () => request<PaymentInfo | null>('/payment-info'),
  updatePaymentInfo: (data: PaymentInfo) =>
    request<PaymentInfo>('/payment-info', { method: 'PUT', body: JSON.stringify(data) }),

  // idempotencyKey: mismo valor entre reintentos del MISMO intento de envío (doble-click, retry
  // tras timeout) evita crear dos reservas duplicadas — ver adminRoutes.js (fb.withIdempotency).
  createManualReservation: (data: ManualReservationInput, idempotencyKey: string) =>
    request<ReservationRecord>('/reservations', { method: 'POST', body: JSON.stringify(data), headers: { 'Idempotency-Key': idempotencyKey } }),

  runRecordAction: (code: string, action: RecordAction) =>
    request<ReservationRecord>(`/records/${code}/${action}`, { method: 'POST' }),

  verifyPayment: (code: string) => request<ReservationRecord>(`/payments/${code}/verify`, { method: 'POST' }),
  rejectPayment: (code: string) => request<ReservationRecord>(`/payments/${code}/reject`, { method: 'POST' }),
  registerCashPayment: (code: string) => request<ReservationRecord>(`/payments/${code}/register-cash`, { method: 'POST' }),

  listUsers: () => request<AdminUser[]>('/users'),
  createUser: (email: string, password: string, role: 'admin' | 'employee') =>
    request<AdminUser>('/users', { method: 'POST', body: JSON.stringify({ email, password, role }) }),
  disableUser: (uid: string) => request<AdminUser>(`/users/${uid}/disable`, { method: 'POST' }),
  enableUser: (uid: string) => request<AdminUser>(`/users/${uid}/enable`, { method: 'POST' }),
  setUserRole: (uid: string, role: 'admin' | 'employee') =>
    request<{ uid: string; role: Role }>(`/users/${uid}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),

  getNotifications: (limit = 50) => request<Notification[]>(`/notifications?limit=${limit}`),
  markNotificationRead: (id: string) => request<{ ok: true }>(`/notifications/${id}/read`, { method: 'POST' }),

  pushSubscribe: (subscription: PushSubscriptionJSON) =>
    request<{ ok: true }>('/push/subscribe', { method: 'POST', body: JSON.stringify(subscription) }),
  pushUnsubscribe: (endpoint: string) =>
    request<{ ok: true }>('/push/unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint }) }),

  getEmployees: () => request<EmployeeOption[]>('/employees'),

  checkIn: (code: string) => request<ReservationRecord>(`/records/${code}/check-in`, { method: 'POST' }),
  checkOut: (code: string) => request<ReservationRecord>(`/records/${code}/check-out`, { method: 'POST' }),

  getContracts: () => request<Contract[]>('/contracts'),
  createContract: (data: Omit<Contract, 'code' | 'status' | 'createdAt' | 'createdBy' | 'payments'>) =>
    request<Contract & { documentEmailSent: boolean }>('/contracts', { method: 'POST', body: JSON.stringify(data) }),
  setContractStatus: (code: string, status: ContractStatus) =>
    request<Contract>(`/contracts/${code}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
  addContractPayment: (code: string, data: { lines: ContractPaymentLine[]; date: string }) =>
    request<{ contract: Contract; payment: ContractPayment; emailSent: boolean }>(`/contracts/${code}/payments`, { method: 'POST', body: JSON.stringify(data) }),
  // Blob, no JSON — no puede pasar por request<T>() (que siempre espera .json()). Mismo patrón
  // de auth que el resto (token fresco en cada llamada), pero descarga directa: crea un <a> con
  // blob: URL y lo clickea solo, porque un <a href> plano no puede llevar el header Authorization.
  downloadContractReceipt: async (code: string, receiptNumber: number): Promise<void> => {
    const headers = await authHeader();
    const res = await fetch(`${API_BASE_URL}/contracts/${code}/payments/${receiptNumber}/pdf`, { headers, cache: 'no-store' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(body as ApiErrorBody, res.status);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recibo-${code}-${receiptNumber}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
  // El documento del contrato en sí (no un abono) — mismo patrón de descarga que arriba.
  downloadContractDocument: async (code: string): Promise<void> => {
    const headers = await authHeader();
    const res = await fetch(`${API_BASE_URL}/contracts/${code}/document/pdf`, { headers, cache: 'no-store' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(body as ApiErrorBody, res.status);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contrato-${code}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  getCleaningTasks: () => request<CleaningTask[]>('/cleaning'),
  createCleaningTask: (data: Omit<CleaningTask, 'code' | 'status' | 'createdAt' | 'completedAt'>) =>
    request<CleaningTask>('/cleaning', { method: 'POST', body: JSON.stringify(data) }),
  setCleaningStatus: (code: string, status: CleaningStatus) =>
    request<CleaningTask>(`/cleaning/${code}/status`, { method: 'POST', body: JSON.stringify({ status }) }),

  getMaintenanceTickets: () => request<MaintenanceTicket[]>('/maintenance'),
  createMaintenanceTicket: (data: Omit<MaintenanceTicket, 'code' | 'status' | 'createdAt' | 'resolvedAt'>) =>
    request<MaintenanceTicket>('/maintenance', { method: 'POST', body: JSON.stringify(data) }),
  setMaintenanceStatus: (code: string, status: MaintenanceStatus) =>
    request<MaintenanceTicket>(`/maintenance/${code}/status`, { method: 'POST', body: JSON.stringify({ status }) }),

  getSiteTraffic: (days = 30) => request<SiteTrafficDay[]>(`/site-traffic?days=${days}`),

  getAuditLog: (limit = 200) => request<AuditLogEntry[]>(`/audit-log?limit=${limit}`),
};

// Mensajes listos para mostrar en la UI ante los errores más comunes — un solo lugar, para no
// repetir "¿qué significa este código?" en cada pantalla.
export const API_ERROR_MESSAGES: Record<string, string> = {
  timeout: 'El servidor está tardando en responder — en el plan gratuito, la primera petición tras un rato de inactividad puede tardar hasta 30 segundos en despertar. Intenta de nuevo en un momento.',
  'network-error': 'No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo.',
  'not-authenticated': 'Tu sesión no es válida. Cierra sesión y vuelve a entrar.',
  'invalid-token': 'Tu sesión venció. Cierra sesión y vuelve a entrar.',
  'not-super-admin': 'Esta acción es solo para el administrador principal.',
  forbidden: 'No tienes permiso para hacer esto.',
  'cannot-disable-self': 'No puedes desactivar tu propia cuenta.',
  'invalid-role': 'Rol inválido.',
  'duplicate-request-in-progress': 'Esta acción ya se está procesando — espera un momento antes de reintentar.',
  'reservation-not-active': 'Esta reserva ya está rechazada o cancelada — no se puede verificar/rechazar su pago.',
  'reservation-not-confirmed': 'Solo se puede registrar el check-in de una reserva confirmada.',
  'already-checked-in': 'Esta reserva ya tiene un check-in registrado.',
  'not-checked-in-yet': 'Primero hay que registrar el check-in antes del check-out.',
  'already-checked-out': 'Esta reserva ya tiene un check-out registrado.',
  'checkin-too-early': 'Todavía no se puede — o falta el día de check-in, o ya es el día pero aún no son las 3:00 p.m. (hora de check-in).',
  'contract-not-active': 'Este contrato ya no está activo — no se pueden registrar más abonos.',
};
export function describeApiError(err: unknown): string {
  if (err instanceof ApiError) return API_ERROR_MESSAGES[err.code] ?? `Ocurrió un error (${err.code}).`;
  return 'Ocurrió un error inesperado.';
}
