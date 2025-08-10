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
    tsconfigRootDir: __dirname,
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

    // Additional TypeScript rules
    '@typescript-eslint/no-unused-expressions': 'error',
    '@typescript-eslint/no-unnecessary-condition': 'off',
    '@typescript-eslint/no-explicit-any': ['error', { ignoreRestArgs: false }],

    // Relax unsafe rules globally to avoid overstrict linting on validated gateway data
    '@typescript-eslint/no-unsafe-assignment': 'off',
    '@typescript-eslint/no-unsafe-member-access': 'off',
    '@typescript-eslint/no-unsafe-call': 'off',
    '@typescript-eslint/no-unsafe-argument': 'off',
    '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true, allowBoolean: true }],

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
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
      rules: {
        '@typescript-eslint/no-unused-expressions': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-argument': 'off',
        '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      },
    },
  ],
  settings: {
    ...(module.exports && module.exports.settings ? module.exports.settings : {}),
  },
};