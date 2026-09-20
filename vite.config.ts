import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify - file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      target: 'es2020',
      sourcemap: false,
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return;

            // 1. Data visualization (Recharts + D3 + Victory)
            if (
              id.includes('recharts') ||
              id.includes('d3-') ||
              id.includes('victory-vendor')
            ) {
              return 'vendor-charts';
            }

            // 2. Firebase SDK
            if (id.includes('firebase')) {
              return 'vendor-firebase';
            }

            // 3. Motion animation library
            if (
              id.includes('framer-motion') ||
              id.includes('/motion/') ||
              id.includes('motion-dom') ||
              id.includes('motion-utils')
            ) {
              return 'vendor-motion';
            }

            // 4. Celebration confetti
            if (id.includes('canvas-confetti')) {
              return 'vendor-confetti';
            }

            // 5. Icons
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }

            // 6. React core runtime
            if (
              id.includes('/node_modules/react/') ||
              id.includes('/node_modules/react-dom/')
            ) {
              return 'vendor-react';
            }

            // 7. General utilities & remaining vendor packages
            return 'vendor-misc';
          },
        },
      },
    },
  };
});
