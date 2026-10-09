import js from "@eslint/js";
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "playwright-report/**",
      "test-results/**",
      "release/**",
      "coverage/**",
      "scripts/**"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts", "src/**/*.tsx", "tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "no-undef": "off", // Handled by TS
      "@typescript-eslint/no-unused-vars": "warn"
    }
  }
);