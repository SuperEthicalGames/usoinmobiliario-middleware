import { auth } from './firebase';
import { API_BASE_URL } from './config';
import type {
  Apartment, ReservationRecord, DashboardSummary, PaymentInfo, RecordAction, ManualReservationInput, ApiErrorBody,
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

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = { 'Content-Type': 'application/json', ...(await authHeader()), ...(options.headers || {}) };
  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body as ApiErrorBody, res.status);
  return body as T;
}

export const api = {
  getDashboard: () => request<DashboardSummary>('/dashboard'),
  getApartments: () => request<Apartment[]>('/apartments'),
  getReservations: () => request<ReservationRecord[]>('/reservations'),
  getVisits: () => request<ReservationRecord[]>('/visits'),
  getRecord: (code: string) => request<ReservationRecord>(`/records/${code}`),
  getPaymentInfo: () => request<PaymentInfo | null>('/payment-info'),

  createManualReservation: (data: ManualReservationInput) =>
    request<ReservationRecord>('/reservations', { method: 'POST', body: JSON.stringify(data) }),

  runRecordAction: (code: string, action: RecordAction) =>
    request<ReservationRecord>(`/records/${code}/${action}`, { method: 'POST' }),

  verifyPayment: (code: string) => request<ReservationRecord>(`/payments/${code}/verify`, { method: 'POST' }),
  rejectPayment: (code: string) => request<ReservationRecord>(`/payments/${code}/reject`, { method: 'POST' }),
  registerCashPayment: (code: string) => request<ReservationRecord>(`/payments/${code}/register-cash`, { method: 'POST' }),
};
