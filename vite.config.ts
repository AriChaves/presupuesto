import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// `vite build --mode android` arma la versión para el APK: sin service worker,
// porque dentro de la app de Android no hace falta y dejaría pantallas viejas guardadas.
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    mode !== 'android' &&
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'Presupuesto',
          short_name: 'Presupuesto',
          description: 'Presupuesto personal y gastos compartidos',
          lang: 'es',
          theme_color: '#1F6F4A',
          background_color: '#F5F6F2',
          display: 'standalone',
          start_url: '/',
          icons: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
      }),
  ],
}))
