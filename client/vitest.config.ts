import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const clientRoot = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(clientRoot, '../server');

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'server',
          root: serverRoot,
          environment: 'node',
          globals: true,
          include: ['tests/**/*.test.js'],
        },
      },
      {
        test: {
          name: 'client',
          root: clientRoot,
          environment: 'jsdom',
          globals: true,
          include: ['tests/**/*.test.{js,jsx,ts,tsx}'],
          setupFiles: ['./tests/setup.ts'],
        },
      },
    ],
  },
});
