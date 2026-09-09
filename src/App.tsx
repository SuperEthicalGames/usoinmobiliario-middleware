import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Apartments } from './pages/Apartments';
import { Reservations } from './pages/Reservations';
import { ManualReservation } from './pages/ManualReservation';
import { Payments } from './pages/Payments';
import { Visits } from './pages/Visits';
import { Settings } from './pages/Settings';

function Gate() {
  const { user, loading } = useAuth();

  if (loading) return <div className="flex min-h-screen items-center justify-center text-sm text-ink/50">Cargando...</div>;
  if (!user) return <Login />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="apartamentos" element={<Apartments />} />
        <Route path="reservas" element={<Reservations />} />
        <Route path="reservas/nueva" element={<ManualReservation />} />
        <Route path="pagos" element={<Payments />} />
        <Route path="visitas" element={<Visits />} />
        <Route path="configuracion" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter basename="/usoinmobiliario-middleware">
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </BrowserRouter>
  );
}
