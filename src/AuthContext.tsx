import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { auth } from './firebase';
import { api } from './api';
import type { Role } from './types';

interface AuthState {
  user: User | null;
  loading: boolean;
  role: Role | null;
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
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        // Sesión cerrada (o nunca abierta) — nunca se queda con un rol de una sesión anterior
        // mientras se resuelve la nueva.
        setRole(null);
        setLoading(false);
        return;
      }
      // El rol lo decide el BACKEND (adminAuth.attachRole), no el frontend — evita tener que
      // hardcodear/confiar en el correo del dueño o en cualquier otra regla acá también.
      api.getMe()
        .then((me) => setRole(me.role))
        .catch(() => setRole(null))
        .finally(() => setLoading(false));
    });
  }, []);

  async function login(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
  }
  async function logout() {
    await signOut(auth);
  }

  const isSuperAdmin = role === 'owner';
  return <AuthContext.Provider value={{ user, loading, role, isSuperAdmin, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
