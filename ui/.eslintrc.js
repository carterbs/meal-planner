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
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  env: { browser: true, es6: true, jest: true },
  plugins: ['@typescript-eslint', 'unused-imports', 'react', 'react-hooks', 'jsx-a11y'],
  settings: { react: { version: 'detect' } },
  globals: { React: 'readonly', JSX: 'readonly', HTMLInputElement: 'readonly', HTMLTextAreaElement: 'readonly', HTMLDivElement: 'readonly', Event: 'readonly', Blob: 'readonly' },
  rules: {
    'react/jsx-uses-react': 'error',
    'react/jsx-uses-vars': 'error',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'error',

    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
    'no-unused-vars': 'off',

    'unused-imports/no-unused-imports': 'error',
    'unused-imports/no-unused-vars': ['warn', { vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_' }],

    '@typescript-eslint/no-unused-expressions': 'error',
    '@typescript-eslint/no-unnecessary-condition': 'error',
    '@typescript-eslint/no-explicit-any': ['error', { ignoreRestArgs: false }],
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    '@typescript-eslint/no-unsafe-argument': 'error',
    '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true, allowBoolean: true }],
    '@typescript-eslint/no-unnecessary-type-assertion': 'error',
  },
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.test.tsx'],
      parserOptions: { project: './tsconfig.json', tsconfigRootDir: __dirname },
      rules: {
        '@typescript-eslint/no-unused-expressions': 'off',
      },
    },
  ],
  settings: { ...(module.exports && module.exports.settings ? module.exports.settings : {}) },
};