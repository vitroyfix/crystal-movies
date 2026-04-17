import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host: true, // <--- THIS OPENS VITE TO YOUR WI-FI
    proxy: {
      // Proxies '/api-football' to the football-data.org API to bypass CORS
      '/api-football': {
        target: 'https://api.football-data.org/v4',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-football/, ''),
      },
      // NEW: Proxies your movie player '/api' requests to your VPS Backend
      '/api': {
        target: 'https://crystalmovies.vercel.app/', 
        changeOrigin: true,
        secure: false,
      }
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Group heavy video processing (hls.js)
            if (id.includes('hls.js')) {
              return 'vendor-hls';
            }
            // Group Lucide icons separately
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            // Group backend/DB logic
            if (id.includes('@supabase') || id.includes('firebase')) {
              return 'vendor-backend';
            }
            // Everything else (react, react-dom, etc.)
            return 'vendor-core';
          }
        },
      },
    },
    // Increased to 1000kb to stay within comfortable limits
    chunkSizeWarningLimit: 1000,
  },
})
