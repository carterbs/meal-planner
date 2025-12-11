module.exports = {
  root: false,
  extends: [
    '../.eslintrc.js',
    'plugin:@typescript-eslint/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
    // Do not use project mode to avoid parsing errors on JS files
  },
  env: { node: true, es6: true, jest: true },
  plugins: ['@typescript-eslint', 'unused-imports'],
  globals: {},
  rules: {
    // Base JS rules
    'no-unused-vars': 'off',
    'unused-imports/no-unused-imports': 'error',
    'unused-imports/no-unused-vars': ['warn', { vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_' }],
  },
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.test.tsx'],
      parserOptions: { project: './tsconfig.eslint.json', tsconfigRootDir: __dirname },
      rules: {
        '@typescript-eslint/no-unused-expressions': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-require-imports': 'off',
        'no-useless-escape': 'off',
      },
    },
    {
      files: ['**/*.ts'],
      parserOptions: { project: './tsconfig.eslint.json', tsconfigRootDir: __dirname },
      rules: {
        'no-restricted-imports': 'off',
        'prefer-const': 'error',
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
        '@typescript-eslint/no-unused-expressions': 'error',
        '@typescript-eslint/no-unnecessary-condition': 'error',
        '@typescript-eslint/no-explicit-any': ['error', { ignoreRestArgs: false }],
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-argument': 'off',
        '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true, allowBoolean: true }],
        '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      },
    },
  ],
  ignorePatterns: [
    '**/*.test.ts',
    '**/__mocks__/**',
  ],
};