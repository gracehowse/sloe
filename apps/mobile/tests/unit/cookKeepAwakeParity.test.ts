/**
 * Mobile cook-mode keep-awake parity (ENG-959).
 *
 * Web keeps the screen awake for the entire cook session via
 * `navigator.wakeLock.request("screen")` in
 * `src/app/components/CookMode.tsx`. On mobile the standalone `/cook` screen
 * (`apps/mobile/app/cook.tsx`) calls `useKeepAwake()`, but the INLINE cook
 * overlay in `apps/mobile/app/recipe/[id].tsx` did not — leaving the actual
 * cooking surface with no screen-awake guarantee (the parity gap this ticket
 * closes).
 *
 * The inline overlay renders in two phases that never co-exist: the
 * mise-en-place checklist (`CookMiseEnPlace`) and the step swipe surface
 * (`CookStepSwipeSurface`). Each phase therefore holds its own keep-awake tag,
 * which together match web's whole-session wake lock. We deliberately did NOT
 * add the hook to `recipe/[id].tsx` itself: that file is pinned by the
 * screen-line-budget ratchet (may only shrink), and `useKeepAwake` cannot be
 * called conditionally — so it had to live in the always-mounted children.
 *
 * This is a structural source-level test (same posture as
 * `cookAnalyticsParity.test.ts`): these surfaces pull in
 * react-native-gesture-handler + Animated + expo-keep-awake, which the
 * vitest/jsdom environment cannot render. We assert the import + call exist so
 * a regression that drops keep-awake (re-opening the parity gap) fails CI.
 *
 * NOTE: assertions run against a COMMENT-STRIPPED copy of the source. The doc
 * comments in these files quote `useKeepAwake()` in prose; matching raw source
 * would let a comment alone satisfy the "calls" assertion (the gap would be
 * undetectable). Stripping comments first guarantees the test pins real code.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/** Remove `/* … *​/` block comments and `// …` line comments so assertions
 *  match executable source only — never a quoted mention in a doc comment. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const SWIPE_PATH = resolve(
  __dirname,
  "../../components/cook/CookStepSwipeSurface.tsx",
);
const MISE_PATH = resolve(
  __dirname,
  "../../components/cook/CookMiseEnPlace.tsx",
);
const SWIPE_CODE = stripComments(readFileSync(SWIPE_PATH, "utf8"));
const MISE_CODE = stripComments(readFileSync(MISE_PATH, "utf8"));

const IMPORT_RE =
  /import\s*\{[^}]*\buseKeepAwake\b[^}]*\}\s*from\s*["']expo-keep-awake["']/;
const CALL_RE = /\buseKeepAwake\(\)/;

describe("mobile cook keep-awake parity (ENG-959)", () => {
  describe("CookStepSwipeSurface (cook 'steps' phase)", () => {
    it("imports useKeepAwake from expo-keep-awake", () => {
      expect(SWIPE_CODE).toMatch(IMPORT_RE);
    });

    it("calls useKeepAwake() in the component body", () => {
      expect(SWIPE_CODE).toMatch(CALL_RE);
    });

    it("calls useKeepAwake() unconditionally, before the `enabled` early return", () => {
      // `useKeepAwake` is a hook — calling it after the `if (!enabled) return`
      // early return would violate the rules-of-hooks and skip keep-awake on
      // the non-swipe render path. Pin that the call sits ahead of that return
      // so the screen stays awake whenever the surface is mounted.
      const callIndex = SWIPE_CODE.indexOf("useKeepAwake()");
      const earlyReturnIndex = SWIPE_CODE.indexOf("if (!enabled)");
      expect(callIndex).toBeGreaterThanOrEqual(0);
      expect(earlyReturnIndex).toBeGreaterThanOrEqual(0);
      expect(callIndex).toBeLessThan(earlyReturnIndex);
    });
  });

  describe("CookMiseEnPlace (cook 'mise' phase)", () => {
    it("imports useKeepAwake from expo-keep-awake", () => {
      expect(MISE_CODE).toMatch(IMPORT_RE);
    });

    it("calls useKeepAwake() in the component body", () => {
      expect(MISE_CODE).toMatch(CALL_RE);
    });
  });
});
