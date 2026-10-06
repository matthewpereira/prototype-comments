import js from '@eslint/js';
import globals from 'globals';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettierRecommended from 'eslint-plugin-prettier/recommended';

export default [
  { ignores: ['dist', 'dist-demo'] },
  js.configs.recommended,
  ...tsPlugin.configs['flat/recommended'],
  prettierRecommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: tsParser,
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      'no-empty': ['error', { allowEmptyCatch: true }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
    },
  },
];
