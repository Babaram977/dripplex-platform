import globals from 'globals';

import { createDripplexBaseConfig } from './base.js';

/**
 * @typedef {import('./base.js').DripplexEslintOptions} DripplexEslintOptions
 */

/**
 * ESLint flat config for Next.js App Router applications.
 *
 * @param {DripplexEslintOptions} [options]
 * @returns {import('typescript-eslint').ConfigArray}
 */
export function createDripplexNextjsConfig(options = {}) {
  return [
    ...createDripplexBaseConfig(options),
    {
      languageOptions: {
        globals: {
          ...globals.browser,
          ...globals.node,
        },
      },
      rules: {
        '@typescript-eslint/no-misused-promises': [
          'error',
          { checksVoidReturn: { attributes: false } },
        ],
      },
    },
  ];
}

export const dripplexNextjsConfig = createDripplexNextjsConfig();

export default dripplexNextjsConfig;
