import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './ui';

interface Props { children: ReactNode; }
interface State { error: Error | null; }

// Sin esto, un error de render en CUALQUIER pantalla (un campo inesperado en un dato real que
// no vino como se esperaba, por ejemplo) deja toda la pestaña en blanco, sin ningún mensaje —
// la clase de "bug visual" más grave posible, porque no dice nada de qué pasó. Con esto, se ve
// un mensaje real y un botón para recargar en vez de una página en blanco.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-paper px-4">
          <div className="max-w-sm rounded-2xl border border-line bg-card p-8 text-center shadow-sm">
            <div className="font-display text-lg font-semibold text-ink">Algo salió mal</div>
            <p className="mt-2 text-sm text-ink/60">
              Ocurrió un error inesperado mostrando esta pantalla. Tus datos en Firebase no se vieron afectados.
            </p>
            <p className="mt-2 rounded-lg bg-clay/10 px-3 py-2 text-xs text-clay">{this.state.error.message}</p>
            <Button className="mt-4" onClick={() => window.location.reload()}>Recargar página</Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
