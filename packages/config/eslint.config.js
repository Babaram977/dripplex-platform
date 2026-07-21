import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createDripplexBaseConfig } from './eslint/base.js';

export default createDripplexBaseConfig({
  tsconfigRootDir: path.dirname(fileURLToPath(import.meta.url)),
});
