require("../scripts/load-repo-env.cjs");

/**
 * Vitest global setup for the mobile workspace.
 *
 * Loaded before every test file (see `setupFiles` in `vitest.config.ts`).
 * Responsibilities:
 *   1. Redirect Node's CJS resolver for `react-native` to the host-shim
 *      (`tests/shims/react-native.tsx`) BEFORE RNTL's internal
 *      `require("react-native")` runs. Vite-node aliases are resolved
 *      only for specifiers that traverse vite's plugin chain — CJS
 *      requires inside a node_modules package (e.g. RNTL's
 *      `accessibility.js`) fall through to Node's native loader and
 *      bypass the alias entirely. Patching `Module._resolveFilename`
 *      is the only mechanism that intercepts every require path
 *      regardless of who invokes it.
 *   2. Tell RNTL not to verify jest-only peer-dep versions — we're on
 *      vitest, `react-test-renderer` is the only thing it actually
 *      needs at runtime and the alias above ensures React + RTR stay
 *      version-matched.
 *   3. Disable RNTL's jest-fake-timer auto-detection (vitest's timer
 *      helpers don't masquerade as jest's).
 *   4. Provide `global.IS_REACT_ACT_ENVIRONMENT` so React 19 + RTR
 *      stay quiet about "not wrapped in act(...)" warnings.
 *   5. Provide `requestAnimationFrame` / `cancelAnimationFrame`
 *      polyfills for RN hooks that schedule layout callbacks.
 */
import Module from "node:module";
import { resolve as pathResolve } from "node:path";

// Resolve the shim TSX file on disk. Node's loader hooks then route
// every `require("react-native")` to it. Because the shim is TSX,
// vite-node must still transform it — that works because the initial
// file reference (`__filename`) is inside the apps/mobile workspace,
// which vite-node owns.
const RN_SHIM_PATH = pathResolve(__dirname, "shims", "react-native.cjs");
const RN_SVG_SHIM_PATH = pathResolve(__dirname, "shims", "react-native-svg.cjs");
const RN_GH_SHIM_PATH = pathResolve(__dirname, "shims", "react-native-gesture-handler.cjs");
const LUCIDE_SHIM_PATH = pathResolve(__dirname, "shims", "lucide-react-native.cjs");
// NOTE: static image `require(".../foo.png")` calls are handled by the
// `transform` hook in vitest.config.ts (rewritten to an inline stub), not here —
// vite-node's runtime `require` bypasses this resolver patch.

type RequireInternal = typeof require & {
  resolve: RequireResolve;
};
type ModuleCtor = typeof Module & {
  _resolveFilename: (
    request: string,
    parent: NodeJS.Module | undefined,
    isMain?: boolean,
    options?: { paths?: string[] },
  ) => string;
};

const ModuleRef = Module as unknown as ModuleCtor;
const originalResolveFilename = ModuleRef._resolveFilename;

// Patch Node's CJS resolver. Every `require("react-native")` lands
// here. Non-`react-native` specifiers pass through untouched.
ModuleRef._resolveFilename = function patchedResolveFilename(
  request: string,
  parent: NodeJS.Module | undefined,
  isMain?: boolean,
  options?: { paths?: string[] },
): string {
  if (request === "react-native" || request === "react-native/") {
    // Some Node versions barf on TSX extensions in _resolveFilename.
    // Return the raw path — vite-node's loader will pick it up via its
    // own registered extensions.
    return RN_SHIM_PATH;
  }
  if (request === "react-native-svg" || request === "react-native-svg/") {
    return RN_SVG_SHIM_PATH;
  }
  if (
    request === "react-native-gesture-handler" ||
    request === "react-native-gesture-handler/"
  ) {
    return RN_GH_SHIM_PATH;
  }
  if (request === "lucide-react-native" || request === "lucide-react-native/") {
    return LUCIDE_SHIM_PATH;
  }
  return originalResolveFilename.call(
    ModuleRef,
    request,
    parent,
    Boolean(isMain),
    options,
  );
};

// Also patch `createRequire` — vite-node's external-module loader
// uses it, and the returned `require` function caches the base
// resolver at construction time. We wrap the result so the
// `react-native` redirect persists.
const REDIRECTS: Record<string, string> = {
  "react-native": RN_SHIM_PATH,
  "react-native/": RN_SHIM_PATH,
  "react-native-svg": RN_SVG_SHIM_PATH,
  "react-native-svg/": RN_SVG_SHIM_PATH,
  "react-native-gesture-handler": RN_GH_SHIM_PATH,
  "react-native-gesture-handler/": RN_GH_SHIM_PATH,
  "lucide-react-native": LUCIDE_SHIM_PATH,
  "lucide-react-native/": LUCIDE_SHIM_PATH,
};

const originalCreateRequire = Module.createRequire;
(Module as unknown as { createRequire: (filename: string) => NodeRequire }).createRequire = function wrappedCreateRequire(filename: string): NodeRequire {
  // Cast tightens signature from TS node URL overloads; actual runtime
  // accepts both `string` and `URL`. We only need string here because
  // vite-node + test code always pass strings.
  const real = originalCreateRequire(filename) as RequireInternal;
  const wrapped = function wrappedRequire(id: string) {
    const redirect = REDIRECTS[id];
    if (redirect) return real(redirect);
    return real(id);
  } as RequireInternal;
  wrapped.resolve = function wrappedResolve(id: string, opts?: { paths?: string[] }) {
    const redirect = REDIRECTS[id];
    if (redirect) return redirect;
    return real.resolve(id, opts);
  } as RequireResolve;
  wrapped.cache = real.cache;
  wrapped.extensions = real.extensions;
  wrapped.main = real.main;
  return wrapped;
};

process.env.RNTL_SKIP_DEPS_CHECK = "1";
process.env.RNTL_SKIP_AUTO_DETECT_FAKE_TIMERS = "1";

// React Native injects the `__DEV__` global via Metro's transform; vitest does
// not, so any component that reads `__DEV__` (e.g. the dev-only prebuild hint on
// health-sync.tsx) throws "__DEV__ is not defined" at render. Pin it to `false`
// so tests exercise the PRODUCTION / user-facing branch (matches the
// healthSyncPremiumBarVisual assertion that dev-only instructions are hidden).
if (typeof (globalThis as { __DEV__?: boolean }).__DEV__ === "undefined") {
  (globalThis as { __DEV__: boolean }).__DEV__ = false;
}

// Silences React 19 / RTR warnings about missing act env.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// Silences the React 19 `react-test-renderer is deprecated` console
// warning. RNTL still depends on RTR (the replacement `@testing-library/
// react-native@14` is in alpha); until RNTL 14.x is stable the warning
// is noise, not signal.
(globalThis as unknown as { IS_REACT_NATIVE_TEST_ENVIRONMENT: boolean }).IS_REACT_NATIVE_TEST_ENVIRONMENT = true;

if (
  typeof (
    globalThis as {
      requestAnimationFrame?: (cb: FrameRequestCallback) => number;
    }
  ).requestAnimationFrame !== "function"
) {
  (globalThis as {
    requestAnimationFrame: (cb: FrameRequestCallback) => number;
  }).requestAnimationFrame = (cb) =>
    setTimeout(() => cb(Date.now()), 0) as unknown as number;
}
if (
  typeof (globalThis as { cancelAnimationFrame?: (id: number) => void })
    .cancelAnimationFrame !== "function"
) {
  (globalThis as { cancelAnimationFrame: (id: number) => void }).cancelAnimationFrame = (id) =>
    clearTimeout(id as unknown as NodeJS.Timeout);
}
