import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    // Target modern browsers — enables smaller, faster output
    target: 'esnext',
    rollupOptions: {
      output: {
        // Split heavy libraries into separate chunks so the browser can cache
        // them independently and load them in parallel
        manualChunks: {
          'three': ['three'],
          'react-three': ['@react-three/fiber', '@react-three/drei'],
          'react': ['react', 'react-dom'],
        },
      },
    },
  },
})
