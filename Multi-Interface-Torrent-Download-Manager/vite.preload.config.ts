import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Sandboxed Electron preloads must be unambiguously CommonJS. Keep Electron
// external so the bundle uses Electron's restricted preload require().
export default defineConfig({
  build: {
    outDir: 'dist/main/preload',
    emptyOutDir: true,
    minify: false,
    lib: {
      entry: resolve(import.meta.dirname, 'src/preload/index.ts'),
      formats: ['cjs'],
      fileName: () => 'index.cjs',
    },
    rollupOptions: {
      external: ['electron'],
      output: {
        format: 'cjs',
        entryFileNames: 'index.cjs',
        exports: 'named',
      },
    },
  },
});
