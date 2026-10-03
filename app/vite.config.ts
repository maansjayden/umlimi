import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Everything the core needs (app shell, ORT wasm, model, audio clips, cached price) is precached,
// so after one install the app works in airplane mode.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Umlimi — offline maize helper',
        short_name: 'Umlimi',
        description: 'Offline maize leaf check and fair-price reference, in isiZulu',
        lang: 'zu',
        theme_color: '#2e7d32',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,json,onnx,wasm,mjs,mp3}'],
        maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname === '/data/price.json',
            handler: 'NetworkFirst',
            options: { cacheName: 'price' },
          },
        ],
      },
    }),
  ],
})
