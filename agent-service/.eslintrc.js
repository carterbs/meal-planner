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
    '@typescript-eslint/no-unnecessary-condition': 'off', // Often defensive programming
    
    // Agent service specific rule relaxations
    '@typescript-eslint/no-explicit-any': 'warn', // Sometimes needed for dynamic agent contexts
    
    // Enable TypeScript rules that need project info (now that we have it)
    '@typescript-eslint/no-unnecessary-type-assertion': 'error',
  },
  overrides: [
    // Allow more flexibility in test files for agent service
    {
      files: ['**/*.test.ts', '**/*.test.js', '**/tests/**/*.ts', '**/tests/**/*.js'],
      parserOptions: {
        project: null, // Avoid requiring full TS project for tests
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        '@typescript-eslint/no-unnecessary-type-assertion': 'off',
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