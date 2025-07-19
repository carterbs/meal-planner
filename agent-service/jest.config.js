module.exports = {
  preset: 'ts-jest/presets/default-esm',
  globals: {
    'ts-jest': {
      useESM: true,
      tsconfig: 'tsconfig.json',
      diagnostics: false
    }
  },
  extensionsToTreatAsEsm: ['.ts'],
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/?(*.)+(test).[tj]s?(x)'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  transformIgnorePatterns: [
    'node_modules/(?!(@modelcontextprotocol|@langchain)/)'
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', { 
      useESM: true,
      tsconfig: {
        target: 'ES2022',
        module: 'ES2022',
        moduleResolution: 'node'
      }
    }],
    '^.+\\.js$': ['ts-jest', { useESM: true }]
  },
  moduleNameMapper: {
    '^\.\./cli\.js$': '<rootDir>/tests/__mocks__/cli.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1'
  }
};
