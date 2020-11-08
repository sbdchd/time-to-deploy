module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    sourceType: "module",
    project: "./tsconfig.json",
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ["@typescript-eslint", "import"],
  env: {
    browser: true,
  },
  rules: {
    "import/no-duplicates": "error",
    "no-restricted-globals": [
      "error",
      "close",
      "closed",
      "status",
      "name",
      "length",
      "origin",
      "event",
    ],
    "no-unneeded-ternary": ["error", { defaultAssignment: false }],
    "@typescript-eslint/no-non-null-assertion": "error",
    "@typescript-eslint/await-thenable": "error",
    "@typescript-eslint/no-for-in-array": "error",
    "@typescript-eslint/no-unsafe-call": "error",
    "@typescript-eslint/no-unsafe-return": "error",
    "@typescript-eslint/no-unsafe-assignment": "error",
    "@typescript-eslint/no-unsafe-member-access": "error",
    "@typescript-eslint/prefer-as-const": "error",
    "@typescript-eslint/prefer-reduce-type-parameter": "error",
    "init-declarations": ["error", "always"],
    "no-lonely-if": "error",
    "object-shorthand": ["error", "always"],
    "@typescript-eslint/consistent-type-assertions": [
      "error",
      {
        assertionStyle: "never",
      },
    ],
    eqeqeq: ["error", "smart"],
  },
}
