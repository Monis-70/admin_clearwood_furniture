import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'smart'],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      'jsx-a11y/no-autofocus': 'off',
      'jsx-a11y/anchor-is-valid': 'error',
      'jsx-a11y/label-has-associated-control': 'off',
      'jsx-a11y/no-noninteractive-element-interactions': 'error',
      'jsx-a11y/click-events-have-key-events': 'error',
      'jsx-a11y/no-static-element-interactions': 'error',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['axios', 'ky', 'node-fetch'],
              message: 'All HTTP goes through src/lib/api/client.ts.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'localStorage', message: 'Use src/lib/preferences.ts (UI preferences only).' },
        { name: 'sessionStorage', message: 'Session data never goes to browser storage.' },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'window',
          property: 'localStorage',
          message: 'Use src/lib/preferences.ts (UI preferences only).',
        },
        {
          object: 'window',
          property: 'sessionStorage',
          message: 'Session data never goes to browser storage.',
        },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/lib/api/**', 'src/tests/**', '**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='fetch']",
          message: 'Call the typed API layer (src/lib/api) instead of fetch().',
        },
        {
          selector: "NewExpression[callee.name='XMLHttpRequest']",
          message: 'Uploads go through src/lib/api/upload.ts.',
        },
      ],
    },
  },
  {
    files: [
      'scripts/**/*.{mjs,ts,cts}',
      'local-stack/**/*.{mjs,ts}',
      '*.config.{ts,mts,mjs}',
      'e2e/**/*.ts',
      'e2e-real/**/*.ts',
    ],
    rules: { 'no-console': 'off' },
  },
  {
    files: ['src/tests/**', '**/*.test.{ts,tsx}', 'e2e/**/*.ts'],
    rules: { 'no-restricted-properties': 'off', 'no-restricted-globals': 'off' },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
    'next-env.d.ts',
    'src/contracts/shared/**',
  ]),
]);
