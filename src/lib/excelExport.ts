import type { CleaningTask, Contract, MaintenanceTicket, ReservationRecord } from '../types';

// Todo el filtrado/armado es local sobre los datos que ya expone el backend (mismo criterio que
// paymentsPdf.ts) — sin endpoint nuevo. exceljs se importa dinámico: pesa bastante y solo hace
// falta en el instante de descargar.

export interface ExportRange {
  from: string; // YYYY-MM-DD
  to: string;
  fromTime: string; // HH:mm — solo afecta a fechas que traen hora (marcas de creación/completado)
  toTime: string;
}

export type DatasetKey = 'reservas' | 'visitas' | 'pagos' | 'contratos' | 'abonos' | 'aseo' | 'mantenimiento';
export type ReservationBasis = 'createdAt' | 'checkin';

type Cell = string | number | null;
interface Column { header: string; width: number; kind?: 'money' | 'date' }
export interface Sheet { key: DatasetKey; name: string; columns: Column[]; rows: Cell[][] }

export const DATASETS: { key: DatasetKey; label: string; hint: string; basis: string }[] = [
  { key: 'reservas', label: 'Reservas', hint: 'Estado, huéspedes, total y pago de cada reserva', basis: 'fecha de la solicitud (o de entrada, a elección)' },
  { key: 'visitas', label: 'Visitas / citas', hint: 'Citas agendadas para conocer los apartamentos', basis: 'fecha de la visita' },
  { key: 'pagos', label: 'Pagos recibidos', hint: 'Pagos verificados (transferencia y efectivo)', basis: 'fecha del pago' },
  { key: 'contratos', label: 'Contratos', hint: 'Arrendatarios, canon y estado', basis: 'fecha de inicio' },
  { key: 'abonos', label: 'Abonos de contratos', hint: 'Cada recibo de abono registrado', basis: 'fecha del abono' },
  { key: 'aseo', label: 'Aseo', hint: 'Tareas de limpieza y su avance', basis: 'fecha programada' },
  { key: 'mantenimiento', label: 'Mantenimiento', hint: 'Tickets reportados y su prioridad', basis: 'fecha de reporte' },
];

export interface ExportData {
  reservations: ReservationRecord[];
  contracts: Contract[];
  cleaning: CleaningTask[];
  maintenance: MaintenanceTicket[];
}

// ISO con zona → "YYYY-MM-DDTHH:mm" en hora de Bogotá (UTC-5 fijo, igual que analytics.ts).
function toBogota(ts: string | null | undefined): string | null {
  if (!ts) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(ts)) return `${ts}T00:00`;
  const ms = Date.parse(ts);
  return Number.isNaN(ms) ? null : new Date(ms - 5 * 3600 * 1000).toISOString().slice(0, 16);
}
const datePart = (t: string | null) => (t ? t.slice(0, 10) : '');
const timePart = (t: string | null) => (t ? t.slice(11) : '');

function inRange(dateOrTs: string | null | undefined, r: ExportRange, withTime: boolean): boolean {
  const t = toBogota(dateOrTs);
  if (!t) return false;
  if (!withTime) return datePart(t) >= r.from && datePart(t) <= r.to;
  return t >= `${r.from}T${r.fromTime}` && t <= `${r.to}T${r.toTime}`;
}

const RES_STATUS: Record<string, string> = { pendiente: 'Pendiente', confirmada: 'Confirmada', rechazada: 'Rechazada', cancelada: 'Cancelada', completada: 'Completada' };
const PAY_STATUS: Record<string, string> = { none: 'Sin pago', submitted: 'Por verificar', verified: 'Verificado', rejected: 'Rechazado' };
const CONTRACT_STATUS: Record<string, string> = { activo: 'Activo', finalizado: 'Finalizado', cancelado: 'Cancelado' };
const TERM: Record<string, string> = { semanal: 'Semanal', quincenal: 'Quincenal', mensual: 'Mensual' };
const METHOD: Record<string, string> = { transferencia: 'Transferencia', efectivo: 'Efectivo', otro: 'Otro' };
const CLEAN_STATUS: Record<string, string> = { pendiente: 'Pendiente', 'en-progreso': 'En progreso', completado: 'Completado' };
const MAINT_STATUS: Record<string, string> = { abierto: 'Abierto', 'en-progreso': 'En progreso', resuelto: 'Resuelto' };
const PRIORITY: Record<string, string> = { baja: 'Baja', media: 'Media', alta: 'Alta' };

function payMethodLabel(r: ReservationRecord) { return r.paymentReport ? 'Transferencia' : r.paymentMethod === 'cash' ? 'Efectivo' : ''; }
function payDate(r: ReservationRecord) { return r.paymentReport?.date ?? r.checkin ?? r.createdAt; }
function payAmount(r: ReservationRecord) { return r.paymentReport?.amount ?? r.estTotal ?? 0; }

// Filas de cada hoja ya filtradas. Devuelve solo las hojas pedidas, en el orden del catálogo.
export function buildSheets(
  data: ExportData, keys: DatasetKey[], range: ExportRange, basis: ReservationBasis,
): Sheet[] {
  const sheets: Sheet[] = [];
  const has = (k: DatasetKey) => keys.includes(k);

  if (has('reservas')) {
    const rows = data.reservations
      .filter((r) => r.type === 'reserva' && (basis === 'createdAt' ? inRange(r.createdAt, range, true) : inRange(r.checkin, range, false)))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((r) => {
        const c = toBogota(r.createdAt);
        return [r.code, datePart(c), timePart(c), r.unitLabel, r.name, r.phone, r.email ?? '', r.checkin ?? '', r.checkout ?? '', r.nights ?? null, r.guests ?? null,
          RES_STATUS[r.status] ?? r.status, r.estTotal ?? null, PAY_STATUS[r.paymentStatus ?? 'none'] ?? '', payMethodLabel(r), r.notes ?? ''] as Cell[];
      });
    sheets.push({
      key: 'reservas', name: 'Reservas',
      columns: [
        { header: 'Código', width: 12 }, { header: 'Fecha solicitud', width: 15, kind: 'date' }, { header: 'Hora solicitud', width: 13 },
        { header: 'Apartamento', width: 26 }, { header: 'Huésped', width: 24 }, { header: 'Teléfono', width: 16 }, { header: 'Correo', width: 28 },
        { header: 'Entrada', width: 13, kind: 'date' }, { header: 'Salida', width: 13, kind: 'date' }, { header: 'Noches', width: 9 }, { header: 'Huéspedes', width: 11 },
        { header: 'Estado', width: 14 }, { header: 'Total (COP)', width: 15, kind: 'money' }, { header: 'Estado del pago', width: 16 }, { header: 'Método de pago', width: 16 }, { header: 'Notas', width: 36 },
      ],
      rows,
    });
  }

  if (has('visitas')) {
    const rows = data.reservations
      .filter((r) => r.type === 'cita' && inRange(r.visitDate, range, false))
      .sort((a, b) => (a.visitDate ?? '').localeCompare(b.visitDate ?? '') || (a.visitTime ?? '').localeCompare(b.visitTime ?? ''))
      .map((r) => [r.code, r.visitDate ?? '', r.visitTime ?? '', r.appointmentType === 'general_visit' ? 'Visita general' : 'Visita específica', r.unitLabel, r.name, r.phone, r.email ?? '', RES_STATUS[r.status] ?? r.status, r.notes ?? ''] as Cell[]);
    sheets.push({
      key: 'visitas', name: 'Visitas',
      columns: [
        { header: 'Código', width: 12 }, { header: 'Fecha visita', width: 14, kind: 'date' }, { header: 'Hora', width: 9 }, { header: 'Tipo', width: 18 },
        { header: 'Apartamento', width: 26 }, { header: 'Visitante', width: 24 }, { header: 'Teléfono', width: 16 }, { header: 'Correo', width: 28 }, { header: 'Estado', width: 14 }, { header: 'Notas', width: 36 },
      ],
      rows,
    });
  }

  if (has('pagos')) {
    const rows = data.reservations
      .filter((r) => r.type === 'reserva' && r.paymentStatus === 'verified' && inRange(payDate(r), range, false))
      .sort((a, b) => datePart(toBogota(payDate(a))).localeCompare(datePart(toBogota(payDate(b)))))
      .map((r) => [datePart(toBogota(payDate(r))), r.code, r.unitLabel, r.name, payMethodLabel(r), r.paymentReport?.bank ?? '', r.paymentReport?.reference ?? '', payAmount(r)] as Cell[]);
    sheets.push({
      key: 'pagos', name: 'Pagos recibidos',
      columns: [
        { header: 'Fecha de pago', width: 14, kind: 'date' }, { header: 'Reserva', width: 12 }, { header: 'Apartamento', width: 26 }, { header: 'Cliente', width: 24 },
        { header: 'Método', width: 15 }, { header: 'Banco', width: 18 }, { header: 'Referencia', width: 18 }, { header: 'Monto (COP)', width: 15, kind: 'money' },
      ],
      rows,
    });
  }

  if (has('contratos')) {
    const rows = data.contracts
      .filter((c) => inRange(c.startDate, range, false))
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .map((c) => [c.code, c.unitLabel, c.roomCode, c.tenants.map((t) => `${t.name} (${t.documentId})`).join('; '), c.jointDebtor?.name ?? '', c.startDate, c.endDate,
        c.monthlyRent, TERM[c.paymentTerm] ?? c.paymentTerm, c.depositAmount ?? null, CONTRACT_STATUS[c.status] ?? c.status,
        c.payments.reduce((s, p) => s + p.lines.reduce((x, l) => x + l.amount, 0), 0), c.notes ?? ''] as Cell[]);
    sheets.push({
      key: 'contratos', name: 'Contratos',
      columns: [
        { header: 'Código', width: 12 }, { header: 'Apartamento', width: 26 }, { header: 'Habitación', width: 12 }, { header: 'Arrendatarios', width: 40 }, { header: 'Deudor solidario', width: 24 },
        { header: 'Inicio', width: 13, kind: 'date' }, { header: 'Fin', width: 13, kind: 'date' }, { header: 'Canon mensual', width: 16, kind: 'money' }, { header: 'Periodicidad', width: 13 },
        { header: 'Depósito', width: 15, kind: 'money' }, { header: 'Estado', width: 13 }, { header: 'Total abonado', width: 16, kind: 'money' }, { header: 'Notas', width: 36 },
      ],
      rows,
    });
  }

  if (has('abonos')) {
    const rows: Cell[][] = [];
    for (const c of data.contracts) {
      for (const p of c.payments) {
        if (!inRange(p.date, range, false)) continue;
        const by = (m: string) => p.lines.filter((l) => l.method === m).reduce((s, l) => s + l.amount, 0);
        rows.push([p.date, c.code, c.unitLabel, c.tenants.map((t) => t.name).join('; '), p.receiptNumber, p.periodStart, p.periodEnd,
          by('transferencia'), by('efectivo'), by('otro'), p.lines.reduce((s, l) => s + l.amount, 0), p.balanceAfter,
          p.lines.filter((l) => l.description).map((l) => `${METHOD[l.method]}: ${l.description}`).join('; ')]);
      }
    }
    rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    sheets.push({
      key: 'abonos', name: 'Abonos',
      columns: [
        { header: 'Fecha', width: 13, kind: 'date' }, { header: 'Contrato', width: 12 }, { header: 'Apartamento', width: 26 }, { header: 'Arrendatario', width: 28 }, { header: 'Recibo #', width: 10 },
        { header: 'Período desde', width: 14, kind: 'date' }, { header: 'Período hasta', width: 14, kind: 'date' }, { header: 'Transferencia', width: 15, kind: 'money' }, { header: 'Efectivo', width: 14, kind: 'money' },
        { header: 'Otro', width: 13, kind: 'money' }, { header: 'Total abono', width: 15, kind: 'money' }, { header: 'Saldo después', width: 15, kind: 'money' }, { header: 'Detalle', width: 36 },
      ],
      rows,
    });
  }

  if (has('aseo')) {
    const rows = data.cleaning
      .filter((t) => inRange(t.scheduledDate, range, false))
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
      .map((t) => {
        const done = toBogota(t.completedAt);
        return [t.code, t.scheduledDate, t.unitLabel, t.assignedTo ?? '', CLEAN_STATUS[t.status] ?? t.status, t.relatedReservationCode ?? '', datePart(done), timePart(done), t.notes ?? ''] as Cell[];
      });
    sheets.push({
      key: 'aseo', name: 'Aseo',
      columns: [
        { header: 'Código', width: 12 }, { header: 'Fecha programada', width: 16, kind: 'date' }, { header: 'Apartamento', width: 26 }, { header: 'Asignado a', width: 28 }, { header: 'Estado', width: 14 },
        { header: 'Reserva ligada', width: 14 }, { header: 'Fecha completado', width: 16, kind: 'date' }, { header: 'Hora completado', width: 15 }, { header: 'Notas', width: 36 },
      ],
      rows,
    });
  }

  if (has('mantenimiento')) {
    const rows = data.maintenance
      .filter((t) => inRange(t.createdAt, range, true))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((t) => {
        const c = toBogota(t.createdAt);
        const done = toBogota(t.resolvedAt);
        return [t.code, datePart(c), timePart(c), t.unitLabel, t.title, t.description ?? '', PRIORITY[t.priority] ?? t.priority, MAINT_STATUS[t.status] ?? t.status, t.assignedTo ?? '', t.reportedBy ?? '', datePart(done), timePart(done)] as Cell[];
      });
    sheets.push({
      key: 'mantenimiento', name: 'Mantenimiento',
      columns: [
        { header: 'Código', width: 12 }, { header: 'Fecha reporte', width: 14, kind: 'date' }, { header: 'Hora reporte', width: 12 }, { header: 'Apartamento', width: 26 }, { header: 'Problema', width: 28 },
        { header: 'Descripción', width: 40 }, { header: 'Prioridad', width: 11 }, { header: 'Estado', width: 13 }, { header: 'Asignado a', width: 26 }, { header: 'Reportado por', width: 26 },
        { header: 'Fecha resuelto', width: 14, kind: 'date' }, { header: 'Hora resuelto', width: 13 },
      ],
      rows,
    });
  }

  return sheets;
}

const HEAD_FILL = 'FF23262B';
const GOLD = 'FFA5761C';

// Nombre de archivo: uso-inmobiliario_2026-10-01_a_2026-10-31.xlsx
export async function downloadExcel(sheets: Sheet[], range: ExportRange): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'USO Inmobiliario';
  wb.created = new Date();

  const summary = wb.addWorksheet('Resumen');
  summary.columns = [{ width: 28 }, { width: 44 }];
  summary.addRow(['USO Inmobiliario — Exportación de datos']).font = { bold: true, size: 15, color: { argb: HEAD_FILL } };
  summary.addRow([]);
  summary.addRow(['Desde', `${range.from} ${range.fromTime}`]);
  summary.addRow(['Hasta', `${range.to} ${range.toTime}`]);
  summary.addRow(['Generado', new Date().toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })]);
  summary.addRow(['Horario', 'Hora de Colombia (UTC-5)']);
  summary.addRow([]);
  const head = summary.addRow(['Hoja', 'Registros']);
  head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEAD_FILL } };
  for (const s of sheets) summary.addRow([s.name, s.rows.length]);
  summary.getColumn(1).font = { bold: true };

  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name, { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = s.columns.map((c) => ({ header: c.header, width: c.width }));
    ws.addRows(s.rows);
    const header = ws.getRow(1);
    header.height = 22;
    header.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEAD_FILL } };
      cell.alignment = { vertical: 'middle', wrapText: true };
      cell.border = { bottom: { style: 'medium', color: { argb: GOLD } } };
    });
    s.columns.forEach((c, i) => { if (c.kind === 'money') ws.getColumn(i + 1).numFmt = '"$"#,##0'; });
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: s.columns.length } };
    if (s.rows.length === 0) ws.addRow(['Sin registros en este rango']).font = { italic: true, color: { argb: 'FF6B6F76' } };
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `uso-inmobiliario_${range.from}_a_${range.to}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
