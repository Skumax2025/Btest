import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const resolvePath = (relative: string): string =>
  fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@core': resolvePath('./src/core'),
      '@systems': resolvePath('./src/systems'),
      '@game': resolvePath('./src/game'),
      '@content': resolvePath('./src/content'),
      '@ui': resolvePath('./src/ui'),
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
