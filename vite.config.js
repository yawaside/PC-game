import { defineConfig } from 'vite';

// base './' — чтобы сборка открывалась и с file:// (десктопная оболочка Electron),
// и с любого подпути статического хостинга.
export default defineConfig({
  base: './',
  server: { host: '0.0.0.0', port: 5173, allowedHosts: true },
  preview: { host: '0.0.0.0', port: 4173, allowedHosts: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 2000, sourcemap: false },
});
