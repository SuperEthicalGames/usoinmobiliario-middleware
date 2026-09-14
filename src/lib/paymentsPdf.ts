import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ReservationRecord } from '../types';
import { fmtCOP, fmtDate } from '../components/ui';
import type { RevenuePoint } from './analytics';

// Mismos colores de marca que emailService.js (BRAND) del backend — un mismo look & feel entre
// los correos y este reporte, sin inventar una segunda paleta para PDFs.
const BRAND = { forest: '#23262b', clay: '#a5761c', ink: '#1a1d21', muted: '#6b6f76' };

function paymentMethodLabel(r: ReservationRecord): string {
  if (r.paymentReport) return 'Transferencia';
  return r.paymentMethod === 'cash' ? 'Efectivo' : '—';
}
function paymentDateOf(r: ReservationRecord): string {
  return r.paymentReport?.date ?? r.checkin ?? r.createdAt;
}
function paymentAmountOf(r: ReservationRecord): number {
  return r.paymentReport?.amount ?? r.estTotal ?? 0;
}

// Genera el PDF en el navegador con los mismos datos ya calculados en Payments.tsx — sin
// round-trip al backend, mismo criterio que el resto de reportes de Analíticas (todo derivado
// de /reservations, ya cargado). `scopeLabel` describe el filtro de mes activo en pantalla, para
// que el PDF no diga "todos los pagos" cuando en realidad se descargó un mes en particular.
export function downloadPaymentsReportPdf(revenue: RevenuePoint[], payments: ReservationRecord[], scopeLabel: string) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(BRAND.forest);
  doc.rect(0, 0, pageWidth, 26, 'F');
  doc.setTextColor('#f8f4ea');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('USO INMOBILIARIO', 14, 11);
  doc.setFontSize(15);
  doc.text('Reporte de pagos', 14, 19);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generado ${new Date().toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}`, pageWidth - 14, 19, { align: 'right' });

  doc.setTextColor(BRAND.ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Ingresos por mes', 14, 36);

  autoTable(doc, {
    startY: 40,
    head: [['Mes', 'Verificado', 'Por verificar', 'Total']],
    body: revenue.map((p) => [p.label, fmtCOP(p.verified), fmtCOP(p.pending), fmtCOP(p.verified + p.pending)]),
    foot: [['Total período', fmtCOP(revenue.reduce((s, p) => s + p.verified, 0)), fmtCOP(revenue.reduce((s, p) => s + p.pending, 0)), fmtCOP(revenue.reduce((s, p) => s + p.verified + p.pending, 0))]],
    theme: 'striped',
    headStyles: { fillColor: BRAND.forest, textColor: '#f8f4ea' },
    footStyles: { fillColor: '#eeebe3', textColor: BRAND.ink, fontStyle: 'bold' },
    styles: { fontSize: 9 },
    margin: { left: 14, right: 14 },
  });

  const afterRevenueY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`Pagos recibidos — ${scopeLabel}`, 14, afterRevenueY + 12);

  const sortedPayments = [...payments].sort((a, b) => paymentDateOf(b).localeCompare(paymentDateOf(a)));
  autoTable(doc, {
    startY: afterRevenueY + 16,
    head: [['Código', 'Unidad', 'Cliente', 'Método', 'Monto', 'Fecha']],
    body: sortedPayments.map((r) => [r.code, r.unitLabel, r.name, paymentMethodLabel(r), fmtCOP(paymentAmountOf(r)), fmtDate(paymentDateOf(r))]),
    foot: [['', '', '', 'Total', fmtCOP(sortedPayments.reduce((s, r) => s + paymentAmountOf(r), 0)), '']],
    theme: 'striped',
    headStyles: { fillColor: BRAND.forest, textColor: '#f8f4ea' },
    footStyles: { fillColor: '#eeebe3', textColor: BRAND.ink, fontStyle: 'bold' },
    styles: { fontSize: 9 },
    margin: { left: 14, right: 14 },
    didDrawPage: () => {
      doc.setFontSize(8);
      doc.setTextColor(BRAND.muted);
      doc.text('Uso Inmobiliario · Laureles, Medellín', 14, doc.internal.pageSize.getHeight() - 8);
    },
  });

  doc.save(`uso-inmobiliario-pagos-${scopeLabel.replace(/\s+/g, '-').toLowerCase()}.pdf`);
}
