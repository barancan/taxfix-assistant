import next from "eslint-config-next";

/**
 * Flat config. eslint-config-next@16 ships native flat configs (core-web-vitals
 * + typescript), so no FlatCompat shim is required.
 */
const eslintConfig = [
  ...next,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "coverage/**",
      ".local-store/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
