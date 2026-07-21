import { createDripplexBaseConfig } from './base.js';

/**
 * @typedef {import('./base.js').DripplexEslintOptions} DripplexEslintOptions
 */

/**
 * ESLint flat config for NestJS applications.
 *
 * @param {DripplexEslintOptions} [options]
 * @returns {import('typescript-eslint').ConfigArray}
 */
export function createDripplexNestjsConfig(options = {}) {
  return [
    ...createDripplexBaseConfig(options),
    {
      rules: {
        '@typescript-eslint/no-extraneous-class': 'off',
        '@typescript-eslint/explicit-member-accessibility': [
          'error',
          { accessibility: 'explicit', overrides: { constructors: 'no-public' } },
        ],
      },
    },
  ];
}

export const dripplexNestjsConfig = createDripplexNestjsConfig();

export default dripplexNestjsConfig;
