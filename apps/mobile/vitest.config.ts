import { defineConfig, configDefaults } from "vitest/config";
import path from "path";

// Diagnostic vite plugin: rewrites every bare `react-native` specifier to
// the shim path, INCLUDING when the specifier appears inside a node_modules
// package (where `resolve.alias` alone is sometimes skipped in vitest's
// externalised CJS path). Uses `enforce: "pre"` so it runs before vite's
// built-in alias resolver.
import { readFileSync } from "node:fs";

const RN_SHIM = path.resolve(__dirname, "./tests/shims/react-native.cjs");
// Static image imports have no Metro asset pipeline under vitest, so any
// component that loads an image (e.g. SloeLaunchWordmark) would throw "Cannot
// find module" and fail every test that transitively imports it. Two forms are
// handled: static `import x from "./a.png"` (via resolveId → a virtual stub
// module) and runtime `require(".../a.png")` (via the transform hook, since
// runtime requires bypass the plugin resolveId chain). (2026-06-04)
const IMAGE_ASSET_RE = /\.(png|jpe?g|gif|webp|bmp)(\?.*)?$/;
const VIRTUAL_ASSET_ID = "\0virtual:static-asset";

function reactNativeShimPlugin() {
  const normalise = (p: string) => p.replace(/\\/g, "/");
  return {
    name: "rn-shim",
    enforce: "pre" as const,
    async resolveId(source: string, importer: string | undefined) {
      if (process.env.VITEST_RN_SHIM_DEBUG) {

        console.log("[rn-shim] resolveId:", source, "from", importer);
      }
      // Static image asset (ESM import) — resolve to a virtual stub module.
      if (IMAGE_ASSET_RE.test(source)) return VIRTUAL_ASSET_ID;
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
      // Virtual stub for static image imports (resolved above).
      if (id === VIRTUAL_ASSET_ID) {
        return 'export default { uri: "test-asset", width: 1, height: 1 };';
      }
      // Belt-and-braces: even if the resolver lets the real RN path
      // through, rewrite its contents to re-export the shim.
      const ns = normalise(id);
      if (
        ns.includes("/node_modules/react-native/index.js") &&
        !ns.endsWith(".map")
      ) {
        if (process.env.VITEST_RN_SHIM_DEBUG) {

          console.log("[rn-shim] load redirect:", id);
        }
        return readFileSync(RN_SHIM, "utf8");
      }
      return null;
    },
    transform(code: string, id: string) {
      // Rewrite runtime image `require(".../foo.png")` calls to an inline stub.
      // vite-node leaves literal `require()` calls untouched (they bypass the
      // plugin resolveId chain and hit Node's resolver, which has no `.png`
      // loader → "Cannot find module"). Doing it at transform time catches every
      // image require regardless of the runtime require mechanism. Only app
      // source (.ts/.tsx) under the workspace — never node_modules. (2026-06-04)
      if (
        !/\.(t|j)sx?$/.test(id) ||
        normalise(id).includes("/node_modules/") ||
        !/require\(\s*["'][^"']+\.(png|jpe?g|gif|webp|bmp)["']\s*\)/.test(code)
      ) {
        return null;
      }
      const out = code.replace(
        /require\(\s*["'][^"']+\.(?:png|jpe?g|gif|webp|bmp)["']\s*\)/g,
        '({ uri: "test-asset", width: 1, height: 1 })',
      );
      return { code: out, map: null };
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
    // ENG-1337 — this file hangs vitest indefinitely during COLLECTION
    // (module import, before any test body runs — confirmed via
    // console.error instrumentation that never fired, and unaffected by the
    // 10s testTimeout below since that only bounds a running test, not
    // import). `it.skip()` alone would NOT fix this (skipped tests still
    // get collected/imported), so the file must be excluded from discovery
    // entirely until ENG-1337 lands a root cause. Remove this exclude once
    // that ticket resolves and the test runs clean again. Spreads vitest's
    // own default excludes (node_modules etc.) — a bare custom `exclude`
    // array would silently replace them, not merge.
    exclude: [...configDefaults.exclude, "tests/unit/settingsBundleNoStrayText.test.tsx"],
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
    coverage: {
      // Istanbul (not V8): @vitest/coverage-v8 + `pool: "vmThreads"` can hit
      // inspector teardown errors ("Session is not connected") on some Node
      // versions; Istanbul stays stable while preserving the RN shim pool.
      provider: "istanbul",
      reportsDirectory: "./coverage",
      reporter: ["text", "json-summary", "html"],
      include: ["app/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
      exclude: [
        "**/*.d.ts",
        "**/node_modules/**",
        "tests/**",
        ".expo/**",
        "dist/**",
      ],
      // ENG-1351 (2026-07-05): this config previously had NO thresholds
      // block, so mobile coverage could regress freely with nothing to
      // fail against. Honest baseline from `test:coverage` (istanbul
      // provider, app/** + lib/** — mostly large untested RN screens under
      // app/**, e.g. TodayScreen.tsx, planner.tsx): lines 17.27%,
      // statements 16.7%, branches 11.3%, functions 14.74%. Set at those
      // actuals (rounded down slightly for float-rounding headroom) purely
      // to stop further regression — ratchet up as app/** screens get test
      // coverage, see docs/testing/overview.md.
      thresholds: {
        lines: 17,
        statements: 16,
        branches: 11,
        functions: 14,
      },
    },
  },
  resolve: {
    // Mirror Metro's `extraNodeModules.react` dedupe (see metro.config.js):
    // shared `src/lib/*` files are watched from ../../src and would otherwise
    // resolve `react` by walking up to the monorepo root (React 18, for
    // Next.js), while the mobile renderer + components use apps/mobile's
    // React 19. A shared hook (`useCsvImportFlow`, ENG-1234) is the first
    // src/lib module to call React hooks, so without this the two copies
    // collide → "Invalid hook call". Force every `react` import to the mobile
    // copy, exactly as Metro does at runtime.
    dedupe: ["react", "react/jsx-runtime", "react/jsx-dev-runtime"],
    alias: [
      { find: /^react$/, replacement: path.resolve(__dirname, "node_modules/react") },
      { find: "@", replacement: path.resolve(__dirname, ".") },
      // ENG-551 (2026-05-16) — mirror the `@suppr/shared/*` tsconfig
      // path so vitest resolves shared-lib imports the same way the
      // TS compiler does. Without this, every test that touches a
      // shared module would fail to resolve under the new alias.
      { find: /^@suppr\/shared\/(.*)$/, replacement: path.resolve(__dirname, "../../src/lib/$1") },
      { find: /^@suppr\/nutrition-core$/, replacement: path.resolve(__dirname, "../../src/lib/nutrition-core/index.ts") },
      { find: /^@suppr\/nutrition-core\/(.*)$/, replacement: path.resolve(__dirname, "../../src/lib/nutrition-core/$1") },
      // Route `react-native` to our host-shim so RNTL + components share
      // the same module. The shim exports `View`, `Text`, `Pressable`,
      // `TextInput`, `Modal`, `StyleSheet.flatten`, etc.
      { find: /^react-native$/, replacement: path.resolve(__dirname, "./tests/shims/react-native.cjs") },
      { find: /^@expo\/vector-icons$/, replacement: path.resolve(__dirname, "./tests/shims/expo-vector-icons.tsx") },
      { find: /^@expo\/vector-icons\/.*$/, replacement: path.resolve(__dirname, "./tests/shims/expo-vector-icons.tsx") },
      { find: /^react-native-safe-area-context$/, replacement: path.resolve(__dirname, "./tests/shims/safe-area-context.tsx") },
      { find: /^@react-native-async-storage\/async-storage$/, replacement: path.resolve(__dirname, "./tests/shims/async-storage.ts") },
      { find: /^expo-haptics$/, replacement: path.resolve(__dirname, "./tests/shims/expo-haptics.ts") },
      // ENG-685 — `expo-image` loads native SDWebImage bindings at import time;
      // shim re-exports the RN host Image so SmartImage render tests collect.
      { find: /^expo-image$/, replacement: path.resolve(__dirname, "./tests/shims/expo-image.tsx") },
      // ENG-1247 — `expo-blur` ships `build/BlurView.js` with JSX inside a
      // node_modules `.js` file, which vite import-analysis rejects; shim
      // re-exports the RN host View so the frosted-tab-bar render test collects.
      { find: /^expo-blur$/, replacement: path.resolve(__dirname, "./tests/shims/expo-blur.tsx") },
      { find: /^expo-constants$/, replacement: path.resolve(__dirname, "./tests/shims/expo-constants.ts") },
      // 2026-05-02 (MFP CSV import) — `expo-document-picker` ships
      // native bindings that don't survive vitest's vmThreads pool.
      // Tests that need scenario-specific picker behaviour should
      // `vi.doMock("expo-document-picker", ...)` to override the
      // default "user cancelled" result the shim returns.
      { find: /^expo-document-picker$/, replacement: path.resolve(__dirname, "./tests/shims/expo-document-picker.ts") },
      // CreateCustomFoodSheet scan-label (2026-06-11) — `expo-image-picker` loads
      // `expo-modules-core` at import time; shim so FoodSearchPanel render tests collect.
      { find: /^expo-image-picker$/, replacement: path.resolve(__dirname, "./tests/shims/expo-image-picker.ts") },
      // Stub the mobile analytics wrapper (which transitively imports
      // `posthog-react-native` and `react-native-svg`) so tests never
      // touch the PostHog client or load SVG's native Touchable mixin.
      { find: /^@\/lib\/analytics$/, replacement: path.resolve(__dirname, "./tests/shims/analytics.ts") },
      // Shim the PostHog SDK itself (not just the `@/lib/analytics` wrapper):
      // a component importing the REAL analytics via a relative/extensioned
      // path bypasses the wrapper alias and loads `posthog-react-native`, whose
      // storage dereferences `window` in an async path and leaks an unhandled
      // rejection in the node test env (CI failure, 2026-06-01). The fake has
      // no native/window deps. `isFeatureDisabled.test.ts` keeps its own
      // `vi.mock` to drive flag values; that takes precedence for that file.
      { find: /^posthog-react-native$/, replacement: path.resolve(__dirname, "./tests/shims/posthog-react-native.tsx") },
      { find: /^react-native-svg$/, replacement: path.resolve(__dirname, "./tests/shims/react-native-svg.cjs") },
      // F-17 (2026-04-19) — `TodayMealsSection` mounts `Swipeable` from
      // `react-native-gesture-handler`. The real package loads a native
      // spec at import time, which blows up under vitest. Shim forwards
      // children verbatim so RNTL can still walk the tree.
      { find: /^react-native-gesture-handler$/, replacement: path.resolve(__dirname, "./tests/shims/react-native-gesture-handler.cjs") },
      // Phase 6 P2 (2026-04-28) — `PressableScale` and `CalorieRing`
      // import `react-native-reanimated`. The real package loads a
      // worklets binding at import time (`react-native-worklets`) which
      // doesn't survive the vmThreads pool. The shim provides the
      // minimum surface (shared values, withTiming/withSpring,
      // useAnimatedStyle, createAnimatedComponent) so render tests can
      // mount the components without exercising animation internals.
      { find: /^react-native-reanimated$/, replacement: path.resolve(__dirname, "./tests/shims/react-native-reanimated.cjs") },
      { find: /^lucide-react-native$/, replacement: path.resolve(__dirname, "./tests/shims/lucide-react-native.cjs") },
      // ENG-717 — `@sentry/react-native` ships untransformed ESM + native
      // spec loads at import time. Any module importing `./errorTracking`
      // (e.g. `verifyRecipe.ts`, `weeklyRecapPush.ts`) reaches it
      // transitively; the no-op shim keeps such modules collectable.
      { find: /^@sentry\/react-native$/, replacement: path.resolve(__dirname, "./tests/shims/sentry-react-native.cjs") },
    ],
  },
});
