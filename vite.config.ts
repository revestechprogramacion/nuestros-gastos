import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // En GitHub Pages la app cuelga de /nuestros-gastos/, no de la raíz.
  // En desarrollo se queda en '/' para que localhost siga funcionando igual.
  base: process.env.BASE_PUBLICA ?? '/',
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
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        icons: [
          { src: '/iconos/icono-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/iconos/icono-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/iconos/icono-maskable-512.png',
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
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
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
