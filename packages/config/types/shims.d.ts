declare module 'eslint-config-prettier' {
  import type { Linter } from 'eslint';

  const config: Linter.Config;
  export default config;
}

declare module 'eslint-plugin-import' {
  import type { ESLint } from 'eslint';

  const plugin: ESLint.Plugin;
  export default plugin;
}
