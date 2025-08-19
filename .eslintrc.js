module.exports = {
  root: true,
  extends: [
    'eslint:recommended',
  ],
  parser: '@typescript-eslint/parser',
  plugins: [],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  env: {
    es6: true,
    node: true,
    jest: true,
  },
  rules: {
    // Enforce generated types as the only source of API models
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: '../types',
            message:
              'Import API types from @mealplanner/generated instead of ../types.',
          },
          {
            name: './types',
            message:
              'Import API types from @mealplanner/generated instead of ./types.',
          },
          {
            name: '../types.ts',
            message:
              'Import API types from @mealplanner/generated instead of ../types.ts.',
          },
          {
            name: './types.ts',
            message:
              'Import API types from @mealplanner/generated instead of ./types.ts.',
          },
        ],
      },
    ],
  },
  overrides: [
    // Test files
    {
      files: ['**/*.test.ts', '**/*.test.tsx', '**/tests/**/*.ts', '**/tests/**/*.tsx'],
      env: {
        jest: true,
      },
      rules: {
        // Relax some rules for test files
        '@typescript-eslint/no-unused-expressions': 'off',
        'no-undef': 'off',
        'no-restricted-syntax': 'off',
      },
    },
  ],
  ignorePatterns: [
    '**/node_modules/**',
    '**/dist/**', 
    '**/build/**', 
    '**/coverage/**',
    '**/*.config.js',
    'ui/tools/**',
    'tools/**'
  ],
};