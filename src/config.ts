// Nada acá es secreto: el config web de Firebase está diseñado para vivir en código público
// del navegador (la protección real son las Realtime Database rules, no ocultar esto — mismo
// principio ya confirmado y documentado en el repo del sitio, ver AUDITORIA_COMPLETA.md), y la
// URL del backend es simplemente pública. Por eso se commitea tal cual, sin .env — mismo
// criterio que firebase/firebase-config.js en el repo del sitio.
export const firebaseConfig = {
  apiKey: 'AIzaSyDGktvcGphhq6YnccGena-xAY3aR28FLH8',
  authDomain: 'usoinmobiliario-c8e83.firebaseapp.com',
  databaseURL: 'https://usoinmobiliario-c8e83-default-rtdb.firebaseio.com',
  projectId: 'usoinmobiliario-c8e83',
  storageBucket: 'usoinmobiliario-c8e83.firebasestorage.app',
  messagingSenderId: '384093190914',
  appId: '1:384093190914:web:6dde77e07524772e88201b',
};

// Mismo backend de Render que ya atiende el bot de WhatsApp y el chat web del sitio —
// whatsapp-assistant/src/adminRoutes.js expone /admin/api/* protegido con un token real de
// Firebase Auth (adminAuth.js), verificado del lado del servidor en cada request.
export const API_BASE_URL = 'https://usoinmobiliario-whatsapp-bot.onrender.com/admin/api';
