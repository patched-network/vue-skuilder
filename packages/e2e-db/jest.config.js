module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/src/setup/jest-setup.ts'],
  testTimeout: 30000,
  testMatch: ['<rootDir>/src/tests/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/setup/**', '!src/**/*.d.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@vue-skuilder)/)'
  ]
};
