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
            const normalizedId = id.replace(/\\/g, '/');
            if (!normalizedId.includes('node_modules')) return;

            // 1. Data visualization (Recharts + D3 + Victory)
            if (
              normalizedId.includes('recharts') ||
              normalizedId.includes('d3-') ||
              normalizedId.includes('victory-vendor')
            ) {
              return 'vendor-charts';
            }

            // 2. Firebase SDK
            if (normalizedId.includes('firebase')) {
              return 'vendor-firebase';
            }

            // 3. Motion animation library
            if (
              normalizedId.includes('framer-motion') ||
              normalizedId.includes('/motion/') ||
              normalizedId.includes('motion-dom') ||
              normalizedId.includes('motion-utils')
            ) {
              return 'vendor-motion';
            }

            // 4. Celebration confetti
            if (normalizedId.includes('canvas-confetti')) {
              return 'vendor-confetti';
            }

            // 5. Icons
            if (normalizedId.includes('lucide-react')) {
              return 'vendor-icons';
            }

            // 6. React core runtime
            if (
              normalizedId.includes('/node_modules/react/') ||
              normalizedId.includes('/node_modules/react-dom/') ||
              normalizedId.includes('/node_modules/scheduler/')
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
