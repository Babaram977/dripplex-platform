# `@dripplex/config`

Shared TypeScript, ESLint, and Prettier baselines for the DrippleX monorepo.

## Usage

### TypeScript

```json
{
  "extends": "@dripplex/config/typescript/nextjs"
}
```

Available presets:

- `@dripplex/config/typescript/base`
- `@dripplex/config/typescript/nextjs`
- `@dripplex/config/typescript/nestjs`
- `@dripplex/config/typescript/react-library`

### ESLint (flat config)

```js
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDripplexNextjsConfig } from '@dripplex/config/eslint/nextjs';

export default createDripplexNextjsConfig({
  tsconfigRootDir: path.dirname(fileURLToPath(import.meta.url)),
});
```

Factories:

- `createDripplexBaseConfig`
- `createDripplexNextjsConfig`
- `createDripplexNestjsConfig`
- `createDripplexReactLibraryConfig`

### Prettier

Root `.prettierrc.json` mirrors `@dripplex/config/prettier`. Apps may extend that export when needed.
