import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    outDir: 'dist/main/preload',
    emptyOutDir: true,
    minify: false,
    sourcemap: true,
    lib: {
      entry: resolve(process.cwd(), 'src/preload/index.ts'),
      formats: ['cjs'],
      fileName: () => 'index.cjs',
    },
    rollupOptions: {
      external: ['electron'],
      output: {
        format: 'cjs',
        exports: 'named',
      },
    },
  },
});
