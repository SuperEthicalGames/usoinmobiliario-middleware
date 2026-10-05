import { useEffect, useMemo, useState } from 'react';
import { api, describeApiError } from '../api';
import { Button, Card, PageHeader, Select, Spinner, fmtDate } from '../components/ui';
import { DateRangeCalendar, type DateRange } from '../components/DateRangeCalendar';
import { DownloadIcon } from '../components/icons';
import { todayIsoBogota } from '../lib/analytics';
import { DATASETS, buildSheets, downloadExcel, type DatasetKey, type ExportData, type ExportRange, type ReservationBasis } from '../lib/excelExport';

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
const monthStart = (iso: string) => iso.slice(0, 8) + '01';
function monthEnd(iso: string): string {
  const [y, m] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

export function Export() {
  const today = todayIsoBogota();
  const [data, setData] = useState<ExportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [range, setRange] = useState<DateRange>({ from: monthStart(today), to: today });
  const [fromTime, setFromTime] = useState('00:00');
  const [toTime, setToTime] = useState('23:59');
  const [selected, setSelected] = useState<DatasetKey[]>(['reservas', 'pagos']);
  const [basis, setBasis] = useState<ReservationBasis>('createdAt');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setWarnings([]);
    // allSettled: si una fuente falla (ej. el servidor despertando) las demás igual se exportan.
    Promise.allSettled([api.getReservations(), api.getContracts(), api.getCleaningTasks(), api.getMaintenanceTickets()]).then(([res, con, cle, mai]) => {
      const failed: string[] = [];
      const pick = <T,>(r: PromiseSettledResult<T[]>, label: string): T[] => {
        if (r.status === 'fulfilled') return r.value;
        failed.push(`${label}: ${describeApiError(r.reason)}`);
        return [];
      };
      setData({
        reservations: pick(res, 'Reservas y visitas'),
        contracts: pick(con, 'Contratos'),
        cleaning: pick(cle, 'Aseo'),
        maintenance: pick(mai, 'Mantenimiento'),
      });
      setWarnings(failed);
      setLoading(false);
    });
  }
  useEffect(load, []);

  const complete = !!(range.from && range.to);
  const full: ExportRange | null = complete ? { from: range.from!, to: range.to!, fromTime, toTime } : null;
  const timeInvalid = !!full && full.from === full.to && fromTime > toTime;

  // Conteo en vivo por conjunto, para que se vea qué trae el rango antes de descargar.
  const counts = useMemo(() => {
    if (!data || !full || timeInvalid) return null;
    const out = {} as Record<DatasetKey, number>;
    for (const s of buildSheets(data, DATASETS.map((d) => d.key), full, basis)) {
      out[s.key] = s.rows.length;
    }
    return out;
  }, [data, full?.from, full?.to, fromTime, toTime, basis, timeInvalid]); // eslint-disable-line react-hooks/exhaustive-deps

  function preset(from: string, to: string) { setRange({ from, to }); }
  const presets = [
    { label: 'Hoy', from: today, to: today },
    { label: 'Últimos 7 días', from: addDays(today, -6), to: today },
    { label: 'Últimos 30 días', from: addDays(today, -29), to: today },
    { label: 'Este mes', from: monthStart(today), to: monthEnd(today) },
    { label: 'Mes pasado', from: monthStart(addDays(monthStart(today), -1)), to: addDays(monthStart(today), -1) },
    { label: 'Este año', from: today.slice(0, 4) + '-01-01', to: today.slice(0, 4) + '-12-31' },
  ];

  function toggle(k: DatasetKey) { setSelected((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k])); }

  async function onDownload() {
    if (!data || !full) return;
    setBusy(true);
    setError(null);
    try {
      const keys = DATASETS.map((d) => d.key).filter((k) => selected.includes(k));
      await downloadExcel(buildSheets(data, keys, full, basis), full);
    } catch {
      setError('No se pudo generar el archivo. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  const total = counts ? selected.reduce((s, k) => s + (counts[k] ?? 0), 0) : 0;
  const canDownload = !!data && complete && !timeInvalid && selected.length > 0 && !busy;

  return (
    <div>
      <PageHeader title="Exportar a Excel" subtitle="Elige las fechas en el calendario, marca qué información quieres y descarga un archivo de Excel listo para abrir." />

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-16"><Spinner /><p className="text-sm text-muted">Cargando datos...</p></div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,26rem)_1fr]">
          <Card className="p-5 sm:p-6">
            <StepTitle n={1} title="¿De qué fechas?" />
            <div className="mb-4 flex flex-wrap gap-2">
              {presets.map((p) => {
                const active = range.from === p.from && range.to === p.to;
                return (
                  <button
                    key={p.label} type="button" onClick={() => preset(p.from, p.to)}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${active ? 'bg-graphite-900 text-white' : 'border border-line text-muted hover:border-gold/60 hover:text-gold-dark'}`}
                  >{p.label}</button>
                );
              })}
            </div>
            <DateRangeCalendar value={range} onChange={setRange} today={today} />
            <p className="mt-3 min-h-5 text-sm text-ink/80" aria-live="polite">
              {!range.from ? 'Toca el primer día del rango.'
                : !range.to ? <>Desde <b>{fmtDate(range.from)}</b> — toca el último día.</>
                  : range.from === range.to ? <>Solo el <b>{fmtDate(range.from)}</b></>
                    : <>Del <b>{fmtDate(range.from)}</b> al <b>{fmtDate(range.to)}</b></>}
            </p>

            <div className="mt-5 border-t border-line pt-5">
              <div className="mb-2 text-sm font-semibold text-ink/80">Horas del día <span className="font-normal text-muted">(hora de Colombia)</span></div>
              <div className="grid grid-cols-2 gap-3">
                <TimeField label={`Desde (${range.from ? fmtDate(range.from) : 'primer día'})`} value={fromTime} onChange={setFromTime} />
                <TimeField label={`Hasta (${range.to ? fmtDate(range.to) : 'último día'})`} value={toTime} onChange={setToTime} />
              </div>
              {timeInvalid && <p className="mt-2 text-xs font-bold text-red-dark">La hora final debe ser posterior a la inicial.</p>}
              <p className="mt-2 text-xs text-muted">
                La hora aplica a los datos que guardan hora exacta (reservas por fecha de solicitud y tickets de mantenimiento). El resto se filtra por día completo.
              </p>
            </div>
          </Card>

          <div className="space-y-6">
            <Card className="p-5 sm:p-6">
              <StepTitle n={2} title="¿Qué información quieres?" />
              <div className="grid gap-3 sm:grid-cols-2">
                {DATASETS.map((d) => {
                  const on = selected.includes(d.key);
                  return (
                    <label
                      key={d.key}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition focus-within:ring-2 focus-within:ring-gold/50 ${on ? 'border-gold bg-gold/10' : 'border-line hover:border-gold/50'}`}
                    >
                      <input type="checkbox" checked={on} onChange={() => toggle(d.key)} className="mt-1 h-4 w-4 accent-[#a5761c]" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="font-bold text-ink">{d.label}</span>
                          {counts && <span className="rounded-full bg-paper-2 px-2 py-0.5 text-xs font-bold text-ink/70">{counts[d.key] ?? 0}</span>}
                        </span>
                        <span className="block text-xs text-muted">{d.hint}</span>
                        <span className="mt-0.5 block text-[11px] text-ink/50">Por {d.basis}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {selected.includes('reservas') && (
                <Select label="Las reservas se buscan por" value={basis} onChange={(e) => setBasis(e.target.value as ReservationBasis)} className="mt-4 max-w-xs">
                  <option value="createdAt">Fecha en que se solicitaron</option>
                  <option value="checkin">Fecha de entrada (check-in)</option>
                </Select>
              )}
              <div className="mt-4 flex gap-4 text-xs font-bold">
                <button type="button" className="text-gold-dark hover:underline" onClick={() => setSelected(DATASETS.map((d) => d.key))}>Marcar todo</button>
                <button type="button" className="text-muted hover:underline" onClick={() => setSelected([])}>Quitar todo</button>
              </div>
            </Card>

            <Card className="p-5 sm:p-6">
              <StepTitle n={3} title="Descargar" />
              {warnings.length > 0 && (
                <div className="mb-4 rounded-xl border border-red/30 bg-red/5 p-3 text-xs text-red-dark">
                  <b>No se pudieron cargar algunos datos</b> (saldrán vacíos):
                  <ul className="mt-1 list-disc pl-4">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
                  <button onClick={load} className="mt-1.5 font-bold underline">Reintentar</button>
                </div>
              )}
              <p className="mb-4 text-sm text-ink/80">
                {selected.length === 0 ? 'Marca al menos un tipo de información.'
                  : !complete ? 'Termina de elegir el rango de fechas.'
                    : <>Se descargarán <b>{total}</b> registros en <b>{selected.length}</b> {selected.length === 1 ? 'hoja' : 'hojas'}, más una hoja de resumen.</>}
              </p>
              {complete && selected.length > 0 && total === 0 && !timeInvalid && (
                <p className="mb-4 text-xs text-muted">No hay registros en ese rango; el archivo saldrá con las hojas vacías.</p>
              )}
              <Button onClick={onDownload} disabled={!canDownload} className="w-full py-3 text-base sm:w-auto sm:px-8">
                {busy ? <Spinner className="h-4 w-4" /> : <DownloadIcon className="h-5 w-5" />}
                {busy ? 'Generando...' : 'Descargar Excel'}
              </Button>
              {error && <p className="mt-3 text-sm font-medium text-red">{error}</p>}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function StepTitle({ n, title }: { n: number; title: string }) {
  return (
    <h2 className="mb-4 flex items-center gap-2.5 font-display text-lg font-semibold text-ink">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-graphite-900 text-sm text-white">{n}</span>
      {title}
    </h2>
  );
}

function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block font-semibold text-muted">{label}</span>
      <input
        type="time" value={value} onChange={(e) => e.target.value && onChange(e.target.value)}
        className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-gold focus:ring-4 focus:ring-gold/15"
      />
    </label>
  );
}
