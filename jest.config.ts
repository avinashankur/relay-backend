import type { Config } from "jest";

const config: Config = {
  projects: [
    {
      displayName: "unit",
      testMatch: ["<rootDir>/src/**/*.test.ts"],
      testPathIgnorePatterns: ["<rootDir>/src/**/*.integration.test.ts"],
      preset: "ts-jest",
      testEnvironment: "node",
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
      },
      setupFilesAfterFramework: [],
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
      preset: "ts-jest",
      testEnvironment: "node",
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
      },
      globalSetup: "<rootDir>/tests/setup.ts",
      globalTeardown: "<rootDir>/tests/teardown.ts",
      // Integration tests run serially — shared DB + Redis state
      maxWorkers: 1,
      testTimeout: 30_000,
    },
  ],
};

export default config;
