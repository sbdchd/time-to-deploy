module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  modulePathIgnorePatterns: ["<rootDir>/build/"],
  globals: {
    "ts-jest": {
      diagnostics: false,
    },
  },
}
