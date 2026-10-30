import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  server: { host: true },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'charts', test: /node_modules[\/](recharts|d3-[^\/]+|victory-vendor|internmap|decimal\.js-light|es-toolkit|immer|reselect|redux|@reduxjs|react-redux|react-is|use-sync-external-store|clsx|tiny-invariant|eventemitter3)[\/]/, priority: 30 },
            { name: 'vendor', test: /node_modules[\/](react|react-dom|react-router|react-router-dom|scheduler|dexie|dexie-react-hooks|@fontsource-variable)[\/]/, priority: 40 },
          ],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'],
      workbox: { clientsClaim: true, globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'] },
      manifest: {
        name: 'Northstar',
        short_name: 'Northstar',
        description: 'Personal life dashboard: tasks, goals, money, food, learning, people. Data stays on your device.',
        theme_color: '#0c0d10',
        background_color: '#0c0d10',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
        shortcuts: [
          { name: 'Quick capture', short_name: 'Capture', url: './#/?capture=1', icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }] },
          { name: 'Today', url: './#/', icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }] },
        ],
      },
    }),
  ],
})
