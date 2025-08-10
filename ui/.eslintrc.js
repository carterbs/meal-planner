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
    ecmaFeatures: {
      jsx: true,
    },
    project: './tsconfig.json', // Enable TypeScript project info
  },
  env: {
    browser: true,
    es6: true,
    jest: true,
  },
  plugins: [
    '@typescript-eslint',
    'unused-imports',
    'react',
    'react-hooks',
    'jsx-a11y',
  ],
  settings: {
    react: {
      version: 'detect',
    },
  },
  globals: {
    // React globals
    React: 'readonly',
    JSX: 'readonly',
    // DOM types that might not be covered by env: browser
    HTMLInputElement: 'readonly',
    HTMLTextAreaElement: 'readonly',
    HTMLDivElement: 'readonly',
    Event: 'readonly',
    Blob: 'readonly',
  },
  rules: {
    // React-specific rules
    'react/jsx-uses-react': 'error',
    'react/jsx-uses-vars': 'error',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'off',

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
    
    // Enable TypeScript rules that need project info (now that we have it)
    '@typescript-eslint/no-unnecessary-type-assertion': 'error',
  },
  overrides: [
    // Allow limited assertions in transitional files only
    {
      files: ['src/api/agentApi.ts', 'src/hooks/useSession.ts'],
      rules: {
        'no-restricted-syntax': 'off',
      },
    },
    // Test files
    {
      files: ['**/*.test.ts', '**/*.test.tsx'],
      parserOptions: {
        project: null, // Avoid requiring full TS project for tests
      },
      rules: {
        // Relax some rules for test files
        '@typescript-eslint/no-unused-expressions': 'off',
        '@typescript-eslint/no-unnecessary-type-assertion': 'off',
        'no-undef': 'off',
        'no-restricted-syntax': 'off',
      },
    },
  ],
};