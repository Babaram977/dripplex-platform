import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createDripplexBaseConfig } from '@dripplex/config/eslint/base';

export default createDripplexBaseConfig({
  tsconfigRootDir: path.dirname(fileURLToPath(import.meta.url)),
});
