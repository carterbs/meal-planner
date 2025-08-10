module.exports = {
  root: false,
  extends: [
    '../.eslintrc.js', // Extend root configuration
    'plugin:@typescript-eslint/recommended', // Add TypeScript recommended rules
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: './tsconfig.json', // Enable TypeScript project info
  },
  env: {
    node: true,
    es6: true,
    jest: true,
  },
  plugins: [
    '@typescript-eslint',
    'unused-imports',
  ],
  globals: {
    // Node.js globals that might not be covered by env: node
    Buffer: 'readonly',
    TextEncoder: 'readonly',
    TextDecoder: 'readonly',
  },
  rules: {
    // TypeScript rules
    '@typescript-eslint/no-unused-vars': ['error', {
      'argsIgnorePattern': '^_',
      'varsIgnorePattern': '^_',
      'ignoreRestSiblings': true,
    }],
    'no-unused-vars': 'off', // Disable base rule

    // Unused imports detection
    'unused-imports/no-unused-imports': 'error',
    'unused-imports/no-unused-vars': [
      'warn',
      {
        'vars': 'all',
        'varsIgnorePattern': '^_',
        'args': 'after-used',
        'argsIgnorePattern': '^_',
      },
    ],

    // Additional TypeScript rules for dead code
    '@typescript-eslint/no-unused-expressions': 'error',
    '@typescript-eslint/no-unnecessary-condition': 'error',
    '@typescript-eslint/no-explicit-any': ['error', { ignoreRestArgs: false }],
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-argument': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true, allowBoolean: true }],
    '@typescript-eslint/no-unnecessary-type-assertion': 'error',
  },
  overrides: [
    // Allow more flexibility in test files for agent service
    {
      files: ['**/*.test.ts', '**/*.test.js', '**/tests/**/*.ts', '**/tests/**/*.js'],
      parserOptions: {
        project: './tsconfig.json',
      },
      rules: {
        // Keep strict rules but allow unused vars in tests
        '@typescript-eslint/no-unused-vars': 'off',
      },
    },
    // Mock files
    {
      files: ['**/__mocks__/**/*.ts', '**/__mocks__/**/*.js'],
      env: {
        jest: true,
      },
      globals: {
        jest: 'readonly',
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],
};