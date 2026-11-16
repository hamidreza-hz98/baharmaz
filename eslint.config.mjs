import { fixupConfigRules } from "@eslint/compat";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

export default defineConfig([
  ...fixupConfigRules(nextVitals),
  ...fixupConfigRules(nextTypescript),
  prettier,
  {
    files: ["src/modules/**/*.{ts,tsx}", "src/shared/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/app/**",
                "@/server/**",
                "@/storefront/**",
                "@/admin/**",
                "@/theme/**",
                "**/app/**",
                "**/server/**",
                "**/storefront/**",
                "**/admin/**",
                "**/theme/**",
                "next",
                "next/**",
              ],
              message:
                "Domain and shared code must not depend on outer layers.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([".next/**", "next-env.d.ts", "design/**"]),
]);
