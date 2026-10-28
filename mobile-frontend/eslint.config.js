// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", "coverage/*", ".expo/*", "node_modules/*", "e2e/*"],
  },
  {
    // Jest globals for tests, mocks and the jest setup file.
    files: [
      "**/__tests__/**",
      "**/__mocks__/**",
      "jest.setup.js",
      "src/test-utils.js",
    ],
    languageOptions: {
      globals: {
        jest: "readonly",
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
      },
    },
  },
]);
