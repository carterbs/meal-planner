const js = require('@eslint/js');
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const unusedImports = require('eslint-plugin-unused-imports');
const reactPlugin = require('eslint-plugin-react');
const reactHooksPlugin = require('eslint-plugin-react-hooks');
const jsxA11yPlugin = require('eslint-plugin-jsx-a11y');

// Load local ESLint rule from tools/eslint
const localPlugin = {
  rules: {
    'no-generated-type-assertion': require('./tools/eslint/no-generated-type-assertion'),
  },
};

module.exports = [
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
        project: './tsconfig.json',
      },
      globals: {
        React: 'readonly',
        JSX: 'readonly',
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        global: 'readonly',
        require: 'readonly',
        process: 'readonly',
        NodeJS: 'readonly',
        performance: 'readonly',
        jest: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'unused-imports': unusedImports,
      'react': reactPlugin,
      'react-hooks': reactHooksPlugin,
      'jsx-a11y': jsxA11yPlugin,
      'local': localPlugin,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      // Core React rules
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // TypeScript unused variables and imports
      '@typescript-eslint/no-unused-vars': ['error', {
        'argsIgnorePattern': '^_',
        'varsIgnorePattern': '^_',
        'ignoreRestSiblings': true,
      }],

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

      // Disable the default no-unused-vars rule in favor of TypeScript version
      'no-unused-vars': 'off',

      // Additional TypeScript rules for dead code
      '@typescript-eslint/no-unused-expressions': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'off', // Often defensive programming
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      // Discourage type assertions specifically to generated API types
      'local/no-generated-type-assertion': 'error',
      // Enforce generated types as the only source of API models in src/
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '../types',
              message:
                'Import API types from @mealplanner/generated instead of ../types in src/.',
            },
            {
              name: './types',
              message:
                'Import API types from @mealplanner/generated instead of ./types in src/.',
            },
            {
              name: '../types.ts',
              message:
                'Import API types from @mealplanner/generated instead of ../types.ts in src/.',
            },
            {
              name: './types.ts',
              message:
                'Import API types from @mealplanner/generated instead of ./types.ts in src/.',
            },
          ],
        },
      ],

      // React hooks - allow missing dependencies for intentional patterns
      'react-hooks/exhaustive-deps': 'off',
    },
  },
  // Allow limited assertions in transitional files only
  {
    files: ['src/api/agentApi.ts', 'src/hooks/useSession.ts'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
  {
    files: ['**/*.test.{ts,tsx}'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly',
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        global: 'readonly',
        require: 'readonly',
        process: 'readonly',
        NodeJS: 'readonly',
        performance: 'readonly',
      },
    },
    rules: {
      // Relax some rules for test files
      '@typescript-eslint/no-unused-expressions': 'off',
      'no-restricted-syntax': 'off',
    },
  },
];