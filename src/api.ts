import { auth } from './firebase';
import { API_BASE_URL } from './config';
import type {
  Apartment, ReservationRecord, DashboardSummary, PaymentInfo, RecordAction, ManualReservationInput, ApiErrorBody,
  Categories, MeInfo, AdminUser,
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
  getCategories: () => request<Categories>('/categories'),
  getReservations: () => request<ReservationRecord[]>('/reservations'),
  getVisits: () => request<ReservationRecord[]>('/visits'),
  getRecord: (code: string) => request<ReservationRecord>(`/records/${code}`),
  getPaymentInfo: () => request<PaymentInfo | null>('/payment-info'),
  updatePaymentInfo: (data: PaymentInfo) =>
    request<PaymentInfo>('/payment-info', { method: 'PUT', body: JSON.stringify(data) }),

  createManualReservation: (data: ManualReservationInput) =>
    request<ReservationRecord>('/reservations', { method: 'POST', body: JSON.stringify(data) }),

  runRecordAction: (code: string, action: RecordAction) =>
    request<ReservationRecord>(`/records/${code}/${action}`, { method: 'POST' }),

  verifyPayment: (code: string) => request<ReservationRecord>(`/payments/${code}/verify`, { method: 'POST' }),
  rejectPayment: (code: string) => request<ReservationRecord>(`/payments/${code}/reject`, { method: 'POST' }),
  registerCashPayment: (code: string) => request<ReservationRecord>(`/payments/${code}/register-cash`, { method: 'POST' }),

  listAdmins: () => request<AdminUser[]>('/admins'),
  createAdmin: (email: string, password: string) =>
    request<AdminUser>('/admins', { method: 'POST', body: JSON.stringify({ email, password }) }),
  disableAdmin: (uid: string) => request<AdminUser>(`/admins/${uid}/disable`, { method: 'POST' }),
  enableAdmin: (uid: string) => request<AdminUser>(`/admins/${uid}/enable`, { method: 'POST' }),
};

// Mensajes listos para mostrar en la UI ante los errores más comunes — un solo lugar, para no
// repetir "¿qué significa este código?" en cada pantalla.
export const API_ERROR_MESSAGES: Record<string, string> = {
  timeout: 'El servidor está tardando en responder — en el plan gratuito, la primera petición tras un rato de inactividad puede tardar hasta 30 segundos en despertar. Intenta de nuevo en un momento.',
  'network-error': 'No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo.',
  'not-authenticated': 'Tu sesión no es válida. Cierra sesión y vuelve a entrar.',
  'invalid-token': 'Tu sesión venció. Cierra sesión y vuelve a entrar.',
  'not-super-admin': 'Esta acción es solo para el administrador principal.',
};
export function describeApiError(err: unknown): string {
  if (err instanceof ApiError) return API_ERROR_MESSAGES[err.code] ?? `Ocurrió un error (${err.code}).`;
  return 'Ocurrió un error inesperado.';
}
