import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { auth } from './firebase';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

// Único punto de entrada de sesión de todo el panel — sin UI de registro en ningún lado
// (nunca se llama createUserWithEmailAndPassword): la única cuenta válida es la que el dueño
// del negocio ya creó a mano en la consola de Firebase, misma garantía estructural que ya
// existe para el admin de Unity ("solo el admin puede entrar").
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => onAuthStateChanged(auth, (u) => {
    setUser(u);
    setLoading(false);
  }), []);

  async function login(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
  }
  async function logout() {
    await signOut(auth);
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
