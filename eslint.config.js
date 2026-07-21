import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createDripplexBaseConfig } from '@dripplex/config/eslint/base';

export default [
  {
    ignores: ['apps/**', 'packages/**', 'node_modules/**', 'dist/**', 'coverage/**', '.turbo/**'],
  },
  ...createDripplexBaseConfig({
    tsconfigRootDir: path.dirname(fileURLToPath(import.meta.url)),
  }),
];
