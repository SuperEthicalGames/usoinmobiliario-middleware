# Panel administrativo — Uso Inmobiliario

Reemplaza el panel de administración de Unity (nunca terminado). React + Vite + TypeScript +
Tailwind CSS. No tiene backend propio — todas las acciones administrativas (confirmar/rechazar
reservas, verificar pagos, etc.) pasan por `/admin/api/*` en el backend que ya está desplegado
para el bot de WhatsApp: `D:\Portfolio\UsoInmobiliario\whatsapp-assistant\` (repo
[usoinmobiliariodemo](https://github.com/SuperEthicalGames/usoinmobiliariodemo), servicio
`usoinmobiliario-whatsapp-bot` en Render). Ver el plan original para el porqué de esta decisión
(reusar ese backend en vez de reimplementar la lógica de negocio una tercera vez).

## Autenticación

Firebase Auth, Email/Password, una sola cuenta (la misma ya creada para el panel de Unity:
`usoinmobiliario@gmail.com`). **No hay registro en ningún lado de este panel** — la única forma
de que exista una cuenta válida es que el dueño del negocio la cree a mano en Firebase Console.
El panel obtiene un ID token real y lo manda como `Authorization: Bearer` en cada llamada a
`/admin/api/*`; el backend lo verifica server-side (`adminAuth.js`) antes de hacer nada.

## Desarrollo local

```bash
npm install
npm run dev
```

Abre en `http://localhost:5173/usoinmobiliario-middleware/` (el `base` de Vite ya está
configurado para calzar con el subpath de GitHub Pages, así que el path con `/usoinmobiliario-
middleware/` hace falta incluso en local).

El backend, `src/config.ts` (`API_BASE_URL`), y el config de Firebase apuntan siempre al
**backend real desplegado en Render** — no hace falta correr `whatsapp-assistant/` en local
para trabajar en la UI, ya que los ID tokens de Firebase Auth son reales de todas formas.

## Desplegar (GitHub Pages)

```bash
npm run deploy
```

Compila y publica `dist/` a la rama `gh-pages` (usa el paquete `gh-pages`, mismo mecanismo
"Deploy from branch" ya usado por el sitio público — no GitHub Actions). **Pasos manuales, una
sola vez, en la configuración del repo en GitHub**: Settings → Pages → Deploy from branch →
`gh-pages` / `/(root)`.

## Pendiente (pasos manuales del dueño, fuera del código)

1. **Dominio autorizado en Firebase Auth** — la primera vez que alguien intente iniciar sesión
   desde `https://superethicalgames.github.io` (una vez desplegado), puede fallar con
   `auth/unauthorized-domain` si ese origen no está en Firebase Console → Authentication →
   Settings → Authorized domains. `localhost` ya viene autorizado por defecto (por eso el
   desarrollo local nunca tropieza con esto) — agregar el dominio de producción es un paso
   aparte, no automático.
2. El backend (`whatsapp-assistant/config/index.js`, variable `ADMIN_ORIGIN`) ya asume por
   defecto `https://superethicalgames.github.io` como origen permitido para `/admin/api/*` —
   coincide con el despliegue de este repo en GitHub Pages sin tocar nada más. Si el panel
   termina en otro dominio, hay que actualizar esa variable en Render.

## Estructura

```
src/
  config.ts        Config de Firebase (no es secreto) + URL del backend
  firebase.ts       Inicializa Firebase Auth
  api.ts             Cliente tipado de /admin/api/* — agrega el token en cada llamada
  types.ts            Espejo a mano de las formas del backend (sin paquete npm compartido)
  AuthContext.tsx       Sesión (login/logout/usuario actual)
  components/            UI compartida (Layout, StatusBadge, RecordDetail, primitivos)
  pages/                   Las 7 pantallas (Dashboard, Apartamentos, Reservas, Reserva Manual,
                           Pagos, Visitas, Configuración)
```
