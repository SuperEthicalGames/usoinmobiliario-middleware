import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, describeApiError } from '../api';
import type { ReservationRecord } from '../types';

// Código del registro que trajo al usuario a esta pantalla desde una notificación (?code=ABC123).
// `clear` lo quita de la URL una vez consumido, para que recargar o volver atrás no reabra el mismo.
export function useFocusCode() {
  const [params, setParams] = useSearchParams();
  const code = params.get('code');
  const clear = useCallback(() => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('code');
      return next;
    }, { replace: true });
  }, [setParams]);
  return { code, clear };
}

// Para pantallas con acciones directamente en la lista (Pagos, Aseo, Mantenimiento): cuando los
// datos ya cargaron, lleva la fila del registro al centro y la resalta unos segundos.
// `missingCode` viene con el código si no hay ninguna fila con ese código (ya se gestionó, o un
// filtro la oculta) — la pantalla lo muestra como aviso en vez de dejar al usuario sin explicación.
// Cada fila debe llevar `data-code={código}`.
export function useHighlightRow(ready: boolean) {
  const { code, clear } = useFocusCode();
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [missingCode, setMissingCode] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!ready || !code) return;
    const el = document.querySelector<HTMLElement>(`[data-code="${CSS.escape(code)}"]`);
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setHighlighted(code);
      setMissingCode(null);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setHighlighted(null), 4000);
    } else {
      setMissingCode(code);
    }
    clear();
  }, [ready, code, clear]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return { highlighted, missingCode, dismissMissing: () => setMissingCode(null) };
}

// Para Reservas y Visitas: si llegas con ?code=, trae ese registro y lo abre en su panel de detalle
// (donde están confirmar/rechazar/cancelar/verificar pago...), en vez de dejarte buscándolo en la
// lista. `error` trae el motivo si no se pudo abrir (código inexistente, sin permiso, sin red).
export function useOpenFocusedRecord(open: (rec: ReservationRecord) => void) {
  const { code, clear } = useFocusCode();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    clear();
    setError(null);
    api.getRecord(code)
      .then(open)
      .catch((err) => setError(`No se pudo abrir ${code}: ${describeApiError(err)}`));
  }, [code, clear, open]);

  return { error, dismissError: () => setError(null) };
}
