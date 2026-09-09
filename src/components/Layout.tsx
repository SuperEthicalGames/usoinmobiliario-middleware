import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../AuthContext';

// 6 pantallas de nivel superior (Reserva Manual se entra desde Reservas con un botón, no es
// nav propio — mismo criterio ya usado al construir esto en Unity: el brief solo lista 6).
const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/apartamentos', label: 'Apartamentos' },
  { to: '/reservas', label: 'Reservas' },
  { to: '/pagos', label: 'Pagos' },
  { to: '/visitas', label: 'Visitas' },
  { to: '/configuracion', label: 'Configuración' },
];

export function Layout() {
  const { user, isSuperAdmin, logout } = useAuth();
  // Administradores solo aparece para el super admin — restricción real vive en el backend
  // (requireSuperAdmin), esto es solo para no mostrarle a un admin normal un link a algo que
  // de todas formas el servidor le va a rechazar con 403.
  const navItems = isSuperAdmin ? [...NAV_ITEMS, { to: '/administradores', label: 'Administradores' }] : NAV_ITEMS;

  return (
    <div className="flex min-h-screen bg-paper">
      <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-card">
        <div className="border-b border-line px-6 py-5">
          <div className="font-display text-lg font-semibold text-ink">
            USO <em className="text-clay not-italic">Inmobiliario</em>
          </div>
          <div className="text-xs uppercase tracking-wide text-ink/50">Panel administrativo</div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                  isActive ? 'bg-forest text-paper' : 'text-ink/70 hover:bg-sand'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-line px-4 py-4">
          <div className="truncate text-xs text-ink/50" title={user?.email ?? ''}>{user?.email}</div>
          {isSuperAdmin && (
            <span className="mt-1 inline-flex items-center rounded-full bg-forest/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-forest">
              Admin principal
            </span>
          )}
          <button onClick={() => logout()} className="mt-2 block text-sm font-bold text-clay hover:underline">
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
