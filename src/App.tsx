import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';

// Cada pantalla en su propio chunk — el admin casi siempre solo usa 1-2 pantallas por sesión,
// así que no tiene sentido bajar el bundle de las otras 6 en la carga inicial. El login (la
// única pantalla que SIEMPRE se ve, aunque sea un instante) se queda fuera de esto a propósito.
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const Analytics = lazy(() => import('./pages/Analytics').then((m) => ({ default: m.Analytics })));
const Apartments = lazy(() => import('./pages/Apartments').then((m) => ({ default: m.Apartments })));
const Reservations = lazy(() => import('./pages/Reservations').then((m) => ({ default: m.Reservations })));
const ManualReservation = lazy(() => import('./pages/ManualReservation').then((m) => ({ default: m.ManualReservation })));
const Payments = lazy(() => import('./pages/Payments').then((m) => ({ default: m.Payments })));
const Visits = lazy(() => import('./pages/Visits').then((m) => ({ default: m.Visits })));
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })));
const Admins = lazy(() => import('./pages/Admins').then((m) => ({ default: m.Admins })));
const AuditLog = lazy(() => import('./pages/AuditLog').then((m) => ({ default: m.AuditLog })));
const Contracts = lazy(() => import('./pages/Contracts').then((m) => ({ default: m.Contracts })));
const Cleaning = lazy(() => import('./pages/Cleaning').then((m) => ({ default: m.Cleaning })));
const Maintenance = lazy(() => import('./pages/Maintenance').then((m) => ({ default: m.Maintenance })));

function ScreenFallback() {
  return <div className="flex min-h-[50vh] items-center justify-center text-sm text-ink/40">Cargando pantalla...</div>;
}

function Gate() {
  const { user, loading } = useAuth();

  if (loading) return <div className="flex min-h-screen items-center justify-center text-sm text-ink/50">Cargando...</div>;
  if (!user) return <Login />;

  return (
    <Suspense fallback={<ScreenFallback />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="analiticas" element={<Analytics />} />
          <Route path="apartamentos" element={<Apartments />} />
          <Route path="reservas" element={<Reservations />} />
          <Route path="reservas/nueva" element={<ManualReservation />} />
          <Route path="pagos" element={<Payments />} />
          <Route path="visitas" element={<Visits />} />
          <Route path="contratos" element={<Contracts />} />
          <Route path="aseo" element={<Cleaning />} />
          <Route path="mantenimiento" element={<Maintenance />} />
          <Route path="configuracion" element={<Settings />} />
          <Route path="administradores" element={<Admins />} />
          <Route path="bitacora" element={<AuditLog />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <AuthProvider>
          <Gate />
        </AuthProvider>
      </HashRouter>
    </ErrorBoundary>
  );
}
