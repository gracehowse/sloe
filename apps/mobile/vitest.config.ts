import { defineConfig } from "vitest/config";
import path from "path";

const RN_SHIM = path.resolve(__dirname, "./tests/shims/react-native.cjs");

// Diagnostic vite plugin: rewrites every bare `react-native` specifier to
// the shim path, INCLUDING when the specifier appears inside a node_modules
// package (where `resolve.alias` alone is sometimes skipped in vitest's
// externalised CJS path). Uses `enforce: "pre"` so it runs before vite's
// built-in alias resolver.
import { readFileSync } from "node:fs";

function reactNativeShimPlugin() {
  const normalise = (p: string) => p.replace(/\\/g, "/");
  return {
    name: "rn-shim",
    enforce: "pre" as const,
    async resolveId(source: string, importer: string | undefined) {
      if (process.env.VITEST_RN_SHIM_DEBUG) {
        // eslint-disable-next-line no-console
        console.log("[rn-shim] resolveId:", source, "from", importer);
      }
      // Bare specifier — standard alias path.
      if (source === "react-native") return RN_SHIM;
      // Already-resolved path: the installed RN entry. Remap to shim so
      // vite-node's transform never sees raw Flow source.
      const ns = normalise(source);
      if (
        ns.endsWith("/node_modules/react-native/index.js") ||
        ns.endsWith("/node_modules/react-native/index.js.flow")
      ) {
        return RN_SHIM;
      }
      return null;
    },
    async load(id: string) {
      // Belt-and-braces: even if the resolver lets the real RN path
      // through, rewrite its contents to re-export the shim.
      const ns = normalise(id);
      if (
        ns.includes("/node_modules/react-native/index.js") &&
        !ns.endsWith(".map")
      ) {
        if (process.env.VITEST_RN_SHIM_DEBUG) {
          // eslint-disable-next-line no-console
          console.log("[rn-shim] load redirect:", id);
        }
        return readFileSync(RN_SHIM, "utf8");
      }
      return null;
    },
  };
}

/**
 * Vitest config for the mobile workspace.
 *
 * Render tests (post-ship #3, 2026-04-18) use
 * `@testing-library/react-native` against a shimmed `react-native`
 * module so the RN package's Flow-typed entry + native-only globals
 * don't need a full jest-expo preset. The shims live under
 * `tests/shims/*` and are aliased below — do not import them directly
 * from app code; they only apply during test runs.
 *
 * Logic-only tests (the pre-existing `*.test.ts` files under
 * `tests/unit/`) run under the default `node` environment. Render-test
 * files (`*.test.tsx`) need a DOM-like global for RNTL's scheduler +
 * `react-test-renderer`, so they each opt in via a per-file
 * `// @vitest-environment jsdom` directive at the top. We dropped the
 * older `environmentMatchGlobs` config (deprecated in vitest 3, removed
 * in 4) — per-file directives are the official replacement and keep
 * this config flat. If you add a new render test, copy the directive.
 */
export default defineConfig({
  plugins: [reactNativeShimPlugin()],
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
  ssr: {
    // noExternal: true asks vite-node to transform every node_modules
    // dep through the alias resolver instead of letting Node's CJS
    // loader hit raw source. Required because RNTL's internal
    // `require("react-native")` would otherwise bypass `resolve.alias`.
    noExternal: true,
  },
  test: {
    // `vmThreads` runs tests in a Node VM context via vite-node's
    // module runner — unlike `forks` / `threads` it never falls back
    // to Node's native `require` which would re-parse the raw RN source
    // (Flow syntax → `Unexpected token 'typeof'`). All module resolution
    // goes through our aliases.
    pool: "vmThreads",
    // Default env is `node`. Render tests (`*.test.tsx`) opt into jsdom
    // via a per-file `// @vitest-environment jsdom` directive so this
    // config stays flat and free of the deprecated `environmentMatchGlobs`.
    environment: "node",
    // Bumped from default 5s to 10s (2026-04-19): mealPlanAlgo.test.ts
    // flaked intermittently in parallel runs where CPU contention pushed
    // the 7-day plan generator past the 5s budget. Real code runs in
    // ~1s alone; 10s gives a comfortable headroom without hiding real
    // regressions.
    testTimeout: 10_000,
    setupFiles: ["./tests/setup.ts"],
    include: [
      "tests/**/*.test.ts",
      "tests/**/*.test.tsx",
    ],
    // Inline RNTL + RN so vitest applies the `react-native` alias to
    // their internal CJS requires. Without inlining, the externalised
    // CJS path bypasses aliases and `require("react-native")` hits the
    // real Flow-typed RN package → `SyntaxError: Unexpected token 'typeof'`.
    // The `react-native` regex also covers transitive RN packages
    // (`@react-native/*`) that some expo modules reach into.
    server: {
      deps: {
        inline: true,
      },
    },
    globals: true,
  },
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, ".") },
      // Route `react-native` to our host-shim so RNTL + components share
      // the same module. The shim exports `View`, `Text`, `Pressable`,
      // `TextInput`, `Modal`, `StyleSheet.flatten`, etc.
      { find: /^react-native$/, replacement: path.resolve(__dirname, "./tests/shims/react-native.cjs") },
      { find: /^@expo\/vector-icons$/, replacement: path.resolve(__dirname, "./tests/shims/expo-vector-icons.tsx") },
      { find: /^@expo\/vector-icons\/.*$/, replacement: path.resolve(__dirname, "./tests/shims/expo-vector-icons.tsx") },
      { find: /^react-native-safe-area-context$/, replacement: path.resolve(__dirname, "./tests/shims/safe-area-context.tsx") },
      { find: /^@react-native-async-storage\/async-storage$/, replacement: path.resolve(__dirname, "./tests/shims/async-storage.ts") },
      { find: /^expo-haptics$/, replacement: path.resolve(__dirname, "./tests/shims/expo-haptics.ts") },
      { find: /^expo-constants$/, replacement: path.resolve(__dirname, "./tests/shims/expo-constants.ts") },
      // Stub the mobile analytics wrapper (which transitively imports
      // `posthog-react-native` and `react-native-svg`) so tests never
      // touch the PostHog client or load SVG's native Touchable mixin.
      { find: /^@\/lib\/analytics$/, replacement: path.resolve(__dirname, "./tests/shims/analytics.ts") },
      { find: /^react-native-svg$/, replacement: path.resolve(__dirname, "./tests/shims/react-native-svg.cjs") },
      // F-17 (2026-04-19) — `TodayMealsSection` mounts `Swipeable` from
      // `react-native-gesture-handler`. The real package loads a native
      // spec at import time, which blows up under vitest. Shim forwards
      // children verbatim so RNTL can still walk the tree.
      { find: /^react-native-gesture-handler$/, replacement: path.resolve(__dirname, "./tests/shims/react-native-gesture-handler.cjs") },
    ],
  },
});
