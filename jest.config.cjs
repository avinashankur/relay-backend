/** @type {import('jest').Config} */
const config = {
  projects: [
    {
      displayName: "unit",
      testMatch: ["<rootDir>/src/**/*.test.ts"],
      testPathIgnorePatterns: ["\\.integration\\.test\\.ts$"],
      preset: "ts-jest",
      testEnvironment: "node",
      moduleNameMapper: {
        "^(\\.{1,2}/.*)\\.js$": "$1",
        "^@/(.*)\\.js$": "<rootDir>/src/$1",
        "^@/(.*)$": "<rootDir>/src/$1",
      },
      setupFiles: ["<rootDir>/jest.integration.env.cjs"],
      setupFilesAfterEnv: [],
      coverageDirectory: "<rootDir>/coverage/unit",
      collectCoverageFrom: [
        "src/modules/**/*.ts",
        "!src/modules/**/*.test.ts",
        "!src/modules/**/*.integration.test.ts",
        "!src/modules/**/*.types.ts",
        "!src/modules/**/*.validators.ts",
        "!src/modules/**/*.router.ts",
      ],
      coverageThreshold: {
        global: {
          lines: 80,
          branches: 80,
          functions: 80,
          statements: 80,
        },
      },
    },
    {
      displayName: "integration",
      testMatch: ["<rootDir>/src/**/*.integration.test.ts"],
      preset: "ts-jest/presets/default-esm",
      testEnvironment: "node",
      extensionsToTreatAsEsm: [".ts"],
      moduleNameMapper: {
        "^(\\.{1,2}/.*)\\.js$": "$1",
        "^@/(.*)\\.js$": "<rootDir>/src/$1",
        "^@/(.*)$": "<rootDir>/src/$1",
      },
      setupFiles: ["<rootDir>/jest.integration.env.cjs"],
      maxWorkers: 1,
      testTimeout: 30000,
    },
  ],
};

module.exports = config;
