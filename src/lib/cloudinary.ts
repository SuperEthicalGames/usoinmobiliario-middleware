import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from '../config';

// Sube directo del navegador a Cloudinary (unsigned preset, ver config.ts) — el backend nunca
// ve los bytes de la imagen, solo termina guardando la URL resultante vía
// api.updateCategory(). Misma idea que ya usa el proyecto para Resend: un fetch nativo contra
// la API HTTP del proveedor, sin agregar un SDK nuevo al bundle.
export class CloudinaryUploadError extends Error {}

export interface UploadedImage {
  url: string;
  thumbUrl: string;
}

// Transformación insertada en la URL (sin subir un segundo archivo) — Cloudinary genera la
// miniatura al vuelo la primera vez que alguien la pide y la cachea después.
function deriveThumbUrl(secureUrl: string): string {
  return secureUrl.replace('/upload/', '/upload/w_480,h_360,c_fill,q_auto,f_auto/');
}

export async function uploadImage(file: File): Promise<UploadedImage> {
  const body = new FormData();
  body.append('file', file);
  body.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  let res: Response;
  try {
    res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body });
  } catch {
    throw new CloudinaryUploadError('No se pudo conectar con Cloudinary. Revisa tu conexión e intenta de nuevo.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new CloudinaryUploadError(data?.error?.message || `Error subiendo la imagen (${res.status}).`);
  }
  const secureUrl = data.secure_url as string | undefined;
  if (!secureUrl) throw new CloudinaryUploadError('Cloudinary no devolvió una URL válida.');
  return { url: secureUrl, thumbUrl: deriveThumbUrl(secureUrl) };
}
