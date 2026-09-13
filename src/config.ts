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

// Las fotos originales del sitio (antes de que existiera este editor) se guardaron como rutas
// relativas `media/...` — funcionan bien servidas DESDE el sitio público, pero acá en el panel
// (otro dominio) esa misma ruta relativa resuelve contra localhost/este dominio y rompe. Ver
// resolveMediaUrl en lib/media.ts — nunca se reescribe el dato, solo cómo se PREVISUALIZA acá.
export const PUBLIC_SITE_BASE_URL = 'https://superethicalgames.github.io/usoinmobiliario-webdemo/';

// Subida de fotos de apartamentos (sección "Modelos") va DIRECTO del navegador a Cloudinary,
// nunca por el backend — el upload preset "unsigned" es, a propósito, la única forma de subir
// sin exponer un secreto real: cualquiera con este nombre puede subir a la carpeta
// `usoinmobiliario/` de esta cuenta (por eso el preset restringe carpeta/tamaño/formato desde
// el dashboard de Cloudinary, no acá) — el archivo en sí nunca decide qué apartamento lo usa,
// eso lo sigue controlando /admin/api/categories/:typeKey (solo-dueño, ver adminRoutes.js).
export const CLOUDINARY_CLOUD_NAME = 'u8ftt8ip';
export const CLOUDINARY_UPLOAD_PRESET = 'usoinmobiliario_unsigned';
