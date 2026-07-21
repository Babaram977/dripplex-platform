import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createDripplexReactLibraryConfig } from '@dripplex/config/eslint/react-library';

export default [
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  ...createDripplexReactLibraryConfig({
    tsconfigRootDir: path.dirname(fileURLToPath(import.meta.url)),
  }),
];
