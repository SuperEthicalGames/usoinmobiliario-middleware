import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { firebaseConfig } from './config';

const app = initializeApp(firebaseConfig);

// Único propósito de Firebase Auth acá: iniciar sesión como el único admin (cuenta ya creada
// a mano en la consola de Firebase, sin UI de registro en ningún lado de este panel — misma
// garantía estructural que ya se decidió para Unity) y obtener el ID token que
// whatsapp-assistant/src/adminAuth.js verifica en cada llamada a /admin/api/*. Este panel
// nunca lee/escribe Realtime Database directamente — todo pasa por ese backend.
export const auth = getAuth(app);
