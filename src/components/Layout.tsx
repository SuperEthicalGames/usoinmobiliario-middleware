import { useEffect, useState, type ComponentType } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import logoIcon from '../assets/brand/logo-icon.webp';
import {
  BuildingIcon, CalendarIcon, CardIcon, ChartIcon, CloseIcon, DocumentIcon, GearIcon, GridIcon, LogoutIcon,
  MenuIcon, PinIcon, ShieldIcon, SparkleIcon, WrenchIcon, type IconProps,
} from './icons';

// Reserva Manual se entra desde Reservas con un botón, no es nav propio — mismo criterio ya
// usado al construir esto en Unity: el brief original solo listaba 6 pantallas; Analíticas,
// Contratos, Aseo y Mantenimiento se sumaron después para control operativo completo.
const NAV_ITEMS: { to: string; label: string; end?: boolean; icon: ComponentType<IconProps> }[] = [
  { to: '/', label: 'Dashboard', end: true, icon: GridIcon },
  { to: '/analiticas', label: 'Analíticas', icon: ChartIcon },
  { to: '/apartamentos', label: 'Apartamentos', icon: BuildingIcon },
  { to: '/reservas', label: 'Reservas', icon: CalendarIcon },
  { to: '/pagos', label: 'Pagos', icon: CardIcon },
  { to: '/visitas', label: 'Visitas', icon: PinIcon },
  { to: '/contratos', label: 'Contratos', icon: DocumentIcon },
  { to: '/aseo', label: 'Aseo', icon: SparkleIcon },
  { to: '/mantenimiento', label: 'Mantenimiento', icon: WrenchIcon },
  { to: '/configuracion', label: 'Configuración', icon: GearIcon },
];

function SidebarContent({ onNavigate }: { onNavigate: () => void }) {
  const { user, isSuperAdmin, logout } = useAuth();
  // Administradores solo aparece para el super admin — restricción real vive en el backend
  // (requireSuperAdmin), esto es solo para no mostrarle a un admin normal un link a algo que
  // de todas formas el servidor le va a rechazar con 403.
  const navItems: typeof NAV_ITEMS = isSuperAdmin ? [...NAV_ITEMS, { to: '/administradores', label: 'Administradores', icon: ShieldIcon }] : NAV_ITEMS;

  return (
    <>
      <div className="flex items-center gap-3 border-b border-white/10 px-6 py-5">
        <img src={logoIcon} alt="" className="h-9 w-9 shrink-0 object-contain" />
        <div className="min-w-0">
          <div className="font-display text-base font-semibold leading-tight text-white">
            USO <span className="text-gold-light">Inmobiliario</span>
          </div>
          <div className="text-[10px] uppercase tracking-wider text-graphite-400">Panel administrativo</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl border-l-2 px-3.5 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 ${
                isActive
                  ? 'border-gold bg-white/[0.07] text-white'
                  : 'border-transparent text-graphite-400 hover:border-white/20 hover:bg-white/[0.04] hover:text-white'
              }`
            }
          >
            <item.icon className="h-[18px] w-[18px] shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 px-4 py-4">
        <div className="truncate text-xs text-graphite-400" title={user?.email ?? ''}>{user?.email}</div>
        {isSuperAdmin && (
          <span className="mt-1.5 inline-flex items-center rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold-light">
            Admin principal
          </span>
        )}
        <button onClick={() => logout()} className="mt-3 flex items-center gap-1.5 text-sm font-bold text-graphite-400 transition hover:text-white">
          <LogoutIcon className="h-4 w-4" />
          Cerrar sesión
        </button>
      </div>
    </>
  );
}

export function Layout() {
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();

  // Cierra el drawer al navegar (mobile) — sin esto, un tap en un link de la sidebar cambia de
  // pantalla pero deja el overlay abierto tapando la nueva pantalla.
  useEffect(() => { setNavOpen(false); }, [location.pathname]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setNavOpen(false); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex min-h-screen bg-paper">
      {navOpen && (
        <div
          className="fixed inset-0 z-30 bg-graphite-950/60 backdrop-blur-[1px] lg:hidden"
          onClick={() => setNavOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 shrink-0 flex-col bg-graphite-900 transition-transform duration-200 ease-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          navOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <button
          onClick={() => setNavOpen(false)}
          aria-label="Cerrar menú"
          className="absolute right-3 top-4 rounded-lg p-1.5 text-graphite-400 hover:bg-white/5 hover:text-white lg:hidden"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
        <SidebarContent onNavigate={() => setNavOpen(false)} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-card/95 px-4 py-3 backdrop-blur lg:hidden">
          <button
            onClick={() => setNavOpen(true)}
            aria-label="Abrir menú"
            className="rounded-lg p-1.5 text-ink/70 transition hover:bg-paper-2 hover:text-ink"
          >
            <MenuIcon className="h-6 w-6" />
          </button>
          <img src={logoIcon} alt="" className="h-6 w-6 object-contain" />
          <span className="font-display text-sm font-semibold text-ink">USO Inmobiliario</span>
        </header>

        <main className="min-w-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
