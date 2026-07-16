import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import nextPlugin from "@next/eslint-plugin-next";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      "react-hooks": reactHooks,
      "@next/next": nextPlugin,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // This rule flags any setState inside useEffect, including the canonical
      // "fetch data on mount" pattern. It's overly broad for this demo project.
      "react-hooks/set-state-in-effect": "off",
      // Next.js rules
      "@next/next/no-html-link-for-pages": "warn",
      // Relax for demo: allow unused vars prefixed with _
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    ignores: [".next/**", "node_modules/**"],
  }
);
