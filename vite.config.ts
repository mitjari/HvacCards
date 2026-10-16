import { defineConfig } from 'vite';
import pkg from './package.json' with { type: 'json' };

// Builds a single ES module (dist/hvac-cards.js) that Home Assistant loads as a dashboard resource.
export default defineConfig(({ mode }) => ({
  define: {
    __VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: () => 'hvac-cards.js',
    },
    target: 'es2021',
    sourcemap: mode === 'development' ? 'inline' : false,
    minify: mode !== 'development',
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
  // `npm run serve` exposes dist/ to the LAN so a test Home Assistant can load the bundle directly.
  preview: {
    host: true,
    port: 5000,
    strictPort: true,
    cors: true,
  },
}));
