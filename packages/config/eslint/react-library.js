import globals from 'globals';

import { createDripplexBaseConfig } from './base.js';

/**
 * @typedef {import('./base.js').DripplexEslintOptions} DripplexEslintOptions
 */

/**
 * ESLint flat config for shared React component libraries.
 *
 * @param {DripplexEslintOptions} [options]
 * @returns {import('typescript-eslint').ConfigArray}
 */
export function createDripplexReactLibraryConfig(options = {}) {
  return [
    ...createDripplexBaseConfig(options),
    {
      languageOptions: {
        globals: {
          ...globals.browser,
        },
      },
    },
  ];
}

export const dripplexReactLibraryConfig = createDripplexReactLibraryConfig();

export default dripplexReactLibraryConfig;
