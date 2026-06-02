const path = require("path");
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

const projectRoot = __dirname;

// `getSentryExpoConfig` is a drop-in for `getDefaultConfig` that adds the
// Sentry serializer so source-maps + debug IDs are emitted on EAS builds.
// Without it, prod stack traces on TestFlight / App Store stay minified.
// See docs/decisions/2026-05-15-sentry-nextjs-sdk-alignment.md (mobile leg).
/** @type {import('expo/metro-config').MetroConfig} */
const config = getSentryExpoConfig(projectRoot);

// Watch ../../src so the mobile app can import shared nutrition/analytics
// code via ../../../src/*. Deliberately NOT watching the whole monorepo root
// — its node_modules is excluded from EAS Build uploads (.easignore) and
// Metro's implicit root-node_modules check would fail with ENOENT.
config.watchFolders = [
  ...(config.watchFolders ?? []),
  path.resolve(projectRoot, "../../src"),
];

// ENG-551 (2026-05-16) — `@suppr/shared/*` alias mirrors the
// tsconfig path mapping so Metro resolves the same way the TS
// compiler does. Before this, mobile files reached into the shared
// `src/lib` tree via long `../../../../src/lib/...` chains (375
// import statements across the mobile tree) — brittle on any move
// and inconsistent with the `@/` alias used everywhere else in
// mobile. Both resolvers (tsserver + Metro + vitest) must agree on
// the mapping or builds and editor jump-to-definition diverge.
const mobileNodeModules = path.resolve(projectRoot, "node_modules");

// npm sometimes hoists @react-native/* packages to the top-level
// node_modules but leaves a nested react-native/node_modules/@react-native/
// directory containing only a subset (codegen, js-polyfills). Metro stops
// traversal at that nested scope directory and never reaches the top-level
// copy, causing an intermittent ENOENT on virtualized-lists. Pin it
// explicitly here so the resolver always wins regardless of hoist state.
//
// Shared `src/lib/*` files are watched from `../../src`. Metro resolves their
// `node_modules` by walking up to the monorepo root, which ships React 18 for
// Next.js. Expo 54 enables `reactCompiler`, which injects
// `react/compiler-runtime` — that subpath only exists on React 19 in
// `apps/mobile/node_modules`. Prefer the mobile tree for core React packages
// so shared hooks (e.g. `src/lib/motion.ts`) compile and bundle cleanly.
config.resolver = {
  ...(config.resolver ?? {}),
  nodeModulesPaths: [
    mobileNodeModules,
    ...(config.resolver?.nodeModulesPaths ?? []),
  ],
  extraNodeModules: {
    ...((config.resolver && config.resolver.extraNodeModules) || {}),
    "@suppr/shared": path.resolve(projectRoot, "../../src/lib"),
    react: path.resolve(mobileNodeModules, "react"),
    "react-dom": path.resolve(mobileNodeModules, "react-dom"),
    "@react-native/virtualized-lists": path.resolve(
      mobileNodeModules,
      "@react-native/virtualized-lists",
    ),
  },
};

module.exports = config;
