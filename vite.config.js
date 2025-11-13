import { defineConfig } from 'vite';
import compression from 'vite-plugin-compression';

export default defineConfig({
  root: '.',
  publicDir: 'public',

  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    minify: 'terser',
    target: 'esnext', // Support top-level await

    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks for better caching
          'vendor-alpine': ['alpinejs'],
          'vendor-jszip': ['jszip']
        }
      }
    },

    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log in production
        drop_debugger: true
      }
    },

    // Optimize assets
    chunkSizeWarningLimit: 1000
  },

  plugins: [
    compression({
      algorithm: 'gzip',
      ext: '.gz'
    })
  ],

  server: {
    port: 3000,
    open: true,
    cors: true
  },

  resolve: {
    alias: {
      '@': '/src',
      '@components': '/src/components',
      '@stores': '/src/stores',
      '@managers': '/src/managers',
      '@styles': '/src/styles'
    }
  }
});
