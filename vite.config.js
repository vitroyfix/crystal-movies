import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Move all node_modules into separate chunks to stay under 500kb
          if (id.includes('node_modules')) {
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('firebase')) {
              return 'vendor-firebase';
            }
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
            // All other third-party libraries (react, etc.)
            return 'vendor-core';
          }
        },
      },
    },
    // Optional: Increases the threshold to 1000kb if you want to be less strict
    chunkSizeWarningLimit: 1000,
  },
})