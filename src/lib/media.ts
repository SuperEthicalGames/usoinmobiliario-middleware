import { PUBLIC_SITE_BASE_URL } from '../config';

// Solo para PREVISUALIZAR en el panel — nunca toca el valor real que se guarda/manda a la API.
// Una URL completa (https://..., de Cloudinary) se deja tal cual; una ruta relativa `media/...`
// (fotos originales, de antes de este editor) se resuelve contra el sitio público, que es de
// donde en verdad viven esos archivos.
export function resolveMediaUrl(url: string): string {
  if (!url || /^https?:\/\//.test(url)) return url;
  return PUBLIC_SITE_BASE_URL + url.replace(/^\/+/, '');
}
