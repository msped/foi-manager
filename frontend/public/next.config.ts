import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  sassOptions: {
    // Lets stylesheets resolve `govuk-frontend/...` without a relative path.
    // `includePaths` is the webpack sass-loader spelling of the same thing.
    loadPaths: ["node_modules"],
    includePaths: ["node_modules"],
    // govuk-frontend 6.x still uses `@import` internally; don't surface Dart
    // Sass's deprecation warnings for code we don't own.
    //
    // Only list IDs Dart Sass still recognises — silencing a retired one (as
    // `mixed-decls` became in Sass 1.102) is itself a warning.
    quietDeps: true,
    silenceDeprecations: ["import", "global-builtin"],
  },
};

export default nextConfig;
