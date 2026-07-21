import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('gsap')) return 'vendor-gsap';
            if (id.includes('@supabase')) return 'vendor-supabase';
            if (id.includes('jspdf')) return 'vendor-jspdf';
            if (id.includes('recharts')) return 'vendor-recharts';
            return 'vendor-core';
          }
        }
      }
    }
  }
})

