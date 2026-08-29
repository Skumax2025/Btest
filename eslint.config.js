// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Layer discipline (see README "Structure"): a layer may only import layers
 * strictly below it. L0 core < L1 systems < L2 game < L3 content < L4 ui/view.
 * Patterns cover both the path aliases and relative escapes.
 */
const forbid = (layers, message) => ({
  patterns: [
    {
      group: layers.flatMap((layer) => [`@${layer}/*`, `**/${layer}/*`, `**/${layer}`]),
      message,
    },
  ],
});

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always'],
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        forbid(['systems', 'game', 'content', 'ui', 'view'], 'L0 core may not import higher layers.'),
      ],
    },
  },
  {
    files: ['src/systems/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        forbid(['game', 'content', 'ui', 'view'], 'L1 systems may only import L0 core.'),
      ],
    },
  },
  {
    files: ['src/game/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        forbid(['content', 'ui', 'view'], 'L2 game may not import L3 content or L4 ui: data is injected.'),
      ],
    },
  },
  {
    files: ['src/content/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', forbid(['ui', 'view'], 'L3 content may not import L4 ui.')],
    },
  },
  {
    files: ['tests/**/*.ts', 'vite.config.ts'],
    rules: { 'no-restricted-imports': 'off', '@typescript-eslint/explicit-module-boundary-types': 'off' },
  },
);
