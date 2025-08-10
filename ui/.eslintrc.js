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
    'react-hooks/exhaustive-deps': 'error',

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
    
    // Enable TypeScript rules that need project info (now that we have it)
    '@typescript-eslint/no-unnecessary-type-assertion': 'error',
    // Run local rule via relative path rule key (eslint supports plugin rules via resolved path using overrides with processor)
    // We'll include it using ESLint's "overrides" with plugin resolver from relative path below
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
      // Keep type-aware lint for tests too; ensure build parity
      parserOptions: {
        project: './tsconfig.json',
      },
      rules: {
        // Allow expect().toBeCalled() etc.
        '@typescript-eslint/no-unused-expressions': 'off',
        // Keep unsafe-* errors even in tests
      },
    },
    // Note: We can't register local rule as a plugin via file path. We'll keep the file for future packaging.
  ],
  // Use local rule via relative path plugin name alias
  settings: {
    ...(module.exports && module.exports.settings ? module.exports.settings : {}),
  },
};