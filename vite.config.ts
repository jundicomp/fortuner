import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'node:path';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// mode "demo" = satu file HTML dengan server tiruan (tanpa Apps Script), untuk dicoba/preview.
export default defineConfig(({ mode }) => ({
  base: mode === 'demo' ? './' : process.env.VITE_BASE || './',
  plugins: [react(), ...(mode === 'demo' ? [viteSingleFile()] : [])],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  build: { outDir: mode === 'demo' ? 'dist-demo' : 'dist', chunkSizeWarningLimit: 1500 },
}));
