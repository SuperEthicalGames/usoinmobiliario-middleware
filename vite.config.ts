import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// base debe coincidir con el nombre del repo para que funcione en GitHub Pages
// (https://superethicalgames.github.io/usoinmobiliario-middleware/) — sin esto, los assets
// se piden desde la raíz del dominio y todo sale 404 en producción (funciona igual en local
// porque ahí sí se sirve desde la raíz).
export default defineConfig({
  base: '/usoinmobiliario-middleware/',
  plugins: [react(), tailwindcss()],
})
