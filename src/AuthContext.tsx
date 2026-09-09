import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { auth } from './firebase';
import { api } from './api';

interface AuthState {
  user: User | null;
  loading: boolean;
  isSuperAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

// Único punto de entrada de sesión de todo el panel — sin UI de registro en ningún lado
// (nunca se llama createUserWithEmailAndPassword): la única cuenta válida es la que el dueño
// del negocio (o el super admin, ver Admins.tsx) ya creó a mano/desde el panel — misma
// garantía estructural que ya existe para el admin de Unity ("solo el admin puede entrar").
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        // Sesión cerrada (o nunca abierta) — nunca se queda con un isSuperAdmin de una sesión
        // anterior mientras se resuelve la nueva.
        setIsSuperAdmin(false);
        setLoading(false);
        return;
      }
      // isSuperAdmin lo decide el BACKEND (compara el correo contra config.superAdminEmail), no
      // el frontend — evita tener que hardcodear/confiar en ese correo acá también.
      api.getMe()
        .then((me) => setIsSuperAdmin(me.isSuperAdmin))
        .catch(() => setIsSuperAdmin(false))
        .finally(() => setLoading(false));
    });
  }, []);

  async function login(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
  }
  async function logout() {
    await signOut(auth);
  }

  return <AuthContext.Provider value={{ user, loading, isSuperAdmin, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
