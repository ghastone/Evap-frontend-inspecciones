import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import obfuscatorPlugin from 'vite-plugin-javascript-obfuscator'

export default defineConfig({
  server: {
    allowedHosts: true
  },
  plugins: [
    tailwindcss(), // Plugin nativo de Tailwind v4
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'QC Evap Plus - Ingreso',
        short_name: 'QC Evap+',
        description: 'Sistema de control de calidad para planta',
        theme_color: '#1E293B',
        background_color: '#F8FAFC',
        display: 'standalone', 
        orientation: 'landscape', 
        icons: [
          {
            src: '/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    }),
    // NUEVO: Plugin de ofuscación
    obfuscatorPlugin({
      include: ['src/**/*.js', 'src/**/*.jsx'],
      exclude: [/node_modules/],
      apply: 'build', // Muy importante: Solo se aplica al hacer build (producción)
      options: {
        compact: true,
        controlFlowFlattening: true, // Rompe la estructura lógica de los if/else/for
        controlFlowFlatteningThreshold: 0.75, // Aplica al 75% del código (equilibrio seguridad/rendimiento)
        numbersToExpressions: true, // Cambia números por operaciones matemáticas confusas
        simplify: true,
        stringArrayShuffle: true, // Mezcla los textos
        splitStrings: true, // Divide cadenas largas
        stringArrayThreshold: 0.75
      }
    })
  ]
})