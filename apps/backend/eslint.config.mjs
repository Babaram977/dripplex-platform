import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createDripplexNestjsConfig } from '@dripplex/config/eslint/nestjs';

export default [
  ...createDripplexNestjsConfig({
    tsconfigRootDir: path.dirname(fileURLToPath(import.meta.url)),
  }),
  {
    files: ['**/*.spec.ts', '**/test/**/*.ts'],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },
];
