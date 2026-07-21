import path from 'node:path';
import { fileURLToPath } from 'node:url';

import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * @typedef {object} DripplexEslintOptions
 * @property {string} [tsconfigRootDir] Absolute path to the package root that owns tsconfig.json.
 */

/**
 * Shared ESLint flat config for all Dripplex TypeScript packages.
 * Enforces strict typing: `any` is forbidden.
 *
 * @param {DripplexEslintOptions} [options]
 * @returns {import('typescript-eslint').ConfigArray}
 */
export function createDripplexBaseConfig(options = {}) {
  const tsconfigRootDir = options.tsconfigRootDir ?? path.dirname(fileURLToPath(import.meta.url));

  return tseslint.config(
    {
      ignores: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/.next/**',
        '**/.turbo/**',
        '**/coverage/**',
      ],
    },
    js.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    ...tseslint.configs.strictTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
    eslintConfigPrettier,
    {
      languageOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        globals: {
          ...globals.node,
        },
        parserOptions: {
          projectService: true,
          tsconfigRootDir,
        },
      },
      plugins: {
        import: importPlugin,
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/consistent-type-imports': [
          'error',
          { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
        ],
        '@typescript-eslint/no-unused-vars': [
          'error',
          {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
            caughtErrorsIgnorePattern: '^_',
          },
        ],
        '@typescript-eslint/explicit-function-return-type': [
          'error',
          {
            allowExpressions: true,
            allowTypedFunctionExpressions: true,
            allowHigherOrderFunctions: true,
          },
        ],
        '@typescript-eslint/no-floating-promises': 'error',
        '@typescript-eslint/no-misused-promises': 'error',
        '@typescript-eslint/require-await': 'error',
        '@typescript-eslint/return-await': ['error', 'always'],
        'import/order': [
          'error',
          {
            groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'type'],
            'newlines-between': 'always',
            alphabetize: { order: 'asc', caseInsensitive: true },
          },
        ],
        'import/no-duplicates': 'error',
        'no-console': ['warn', { allow: ['warn', 'error'] }],
        eqeqeq: ['error', 'always'],
        'no-var': 'error',
        'prefer-const': 'error',
      },
    },
    {
      files: ['**/*.{js,mjs,cjs}'],
      ...tseslint.configs.disableTypeChecked,
      rules: {
        ...tseslint.configs.disableTypeChecked.rules,
        '@typescript-eslint/explicit-function-return-type': 'off',
      },
    },
  );
}

/** Default export for packages that re-export without customizing the root. */
export const dripplexBaseConfig = createDripplexBaseConfig();

export default dripplexBaseConfig;
