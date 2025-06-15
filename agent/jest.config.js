export default {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/tests/**/*.test.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!(@modelcontextprotocol|@langchain)/)'
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', { 
      useESM: true,
      tsconfig: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'node'
      }
    }],
    '^.+\\.js$': ['ts-jest', { useESM: true }]
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  }
};
