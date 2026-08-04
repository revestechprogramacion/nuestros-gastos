import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Dónde vive la app.
 *
 * En GitHub Pages cuelga de /nuestros-gastos/, no de la raíz del dominio, y
 * eso hay que decírselo a TODO: a Vite, al manifiesto (si no, el icono de la
 * pantalla de inicio abre la raíz y sale un 404) y al service worker.
 * En desarrollo se queda en '/' y localhost sigue igual.
 */
const BASE = process.env.BASE_PUBLICA ?? '/'

export default defineConfig({
  base: BASE,
  // Para poder abrir la app desde fuera de casa a través de un túnel:
  // sin esto Vite rechaza las peticiones que no vengan de localhost.
  server: { allowedHosts: true },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['iconos/apple-touch-icon.png'],
      manifest: {
        name: 'Nuestros Gastos',
        short_name: 'Gastos',
        description: 'Los gastos de casa, compartidos entre los dos.',
        lang: 'es',
        // Con la base delante: es lo que abre el icono del iPhone.
        start_url: BASE,
        scope: BASE,
        id: BASE,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        icons: [
          { src: `${BASE}iconos/icono-192.png`, sizes: '192x192', type: 'image/png' },
          { src: `${BASE}iconos/icono-512.png`, sizes: '512x512', type: 'image/png' },
          {
            src: `${BASE}iconos/icono-maskable-512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // La app se cachea entera para que abra al instante y funcione sin
        // cobertura. Los datos NO se cachean: siempre van contra Supabase.
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        navigateFallback: `${BASE}index.html`,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname.endsWith('supabase.co'),
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
})
