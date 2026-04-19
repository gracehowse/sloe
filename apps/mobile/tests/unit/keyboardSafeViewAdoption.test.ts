/**
 * Mobile `KeyboardSafeView` adoption pin (TestFlight build 9 feedback,
 * 2026-04-19).
 *
 * The in-session tester report — "the iOS keyboard covers the Sign In
 * button on login, and this appears elsewhere too" — traced to screens
 * with text inputs and no keyboard-avoidance wrapper. The fix shipped a
 * shared primitive (`apps/mobile/components/KeyboardSafeView.tsx`) and
 * wrapped the six highest-traffic text-input surfaces in it.
 *
 * This structural test pins adoption: every priority-screen source file
 * must import and render `KeyboardSafeView`, and must no longer carry
 * an inline `KeyboardAvoidingView` (so we don't leave two patterns in
 * the codebase that can drift).
 *
 * Same style as `householdCardParity.test.ts` (source-level grep, not a
 * runtime RNTL render) — full-screen render tests for each surface
 * would be higher-coverage but also higher-cost and slow; the primitive
 * itself is RNTL-tested in `keyboardSafeView.test.tsx`, and this test
 * only needs to guarantee that the primitive is actually wired in.
 *
 * The TestFlight ticket also called out `apps/mobile/app/signup.tsx` —
 * that file does not exist. Sign-up shares the login screen via an
 * `isSignUp` toggle in `apps/mobile/app/login.tsx`, so wrapping login
 * covers both auth flows. Documented in `resolved.md`.
 *
 * Web parity: not applicable. Browser keyboards never cover in-page
 * controls and auto-scroll focused inputs into view, so there is no
 * web primitive to add. Documented in `resolved.md`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");

/**
 * Strip JS line + block comments so the "no inline KeyboardAvoidingView"
 * assertion doesn't trip over a prose mention in a header doc-block.
 * Naive but sufficient — the source files don't contain regex literals
 * or strings shaped like comments. Copied from `householdCardParity`.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const PRIORITY_SCREENS: readonly { label: string; path: string }[] = [
  // Login AND sign-up live in the same file (toggled via `isSignUp`).
  { label: "login (covers sign-up)", path: "app/login.tsx" },
  { label: "onboarding", path: "app/onboarding.tsx" },
  { label: "CreateCustomFoodSheet", path: "components/CreateCustomFoodSheet.tsx" },
  { label: "FoodSearchModal", path: "components/FoodSearchModal.tsx" },
  { label: "weight-tracker", path: "app/weight-tracker.tsx" },
];

describe("KeyboardSafeView adoption — TestFlight build 9 fix D", () => {
  for (const screen of PRIORITY_SCREENS) {
    describe(screen.label, () => {
      const absPath = resolve(ROOT, screen.path);
      const src = readFileSync(absPath, "utf8");
      const code = stripComments(src);

      it("imports KeyboardSafeView from the shared primitive", () => {
        // Either the `@/components/...` path alias or a relative
        // `./KeyboardSafeView` import is acceptable — both resolve to
        // the same file.
        const aliasImport = /from\s+["']@\/components\/KeyboardSafeView["']/.test(src);
        const relativeImport = /from\s+["']\.\/KeyboardSafeView["']/.test(src);
        expect(aliasImport || relativeImport).toBe(true);
      });

      it("actually renders <KeyboardSafeView> (not just imports it)", () => {
        expect(code).toMatch(/<KeyboardSafeView\b/);
        expect(code).toMatch(/<\/KeyboardSafeView>/);
      });

      it("does not leave an inline <KeyboardAvoidingView> behind (one pattern, not two)", () => {
        // The primitive itself uses KeyboardAvoidingView internally, so
        // this test only runs against the consumer files — not the
        // primitive. The consumer should no longer render its own KAV.
        expect(code).not.toMatch(/<KeyboardAvoidingView\b/);
        // Also strip the bare import — if the file has no runtime KAV
        // usage there's no reason to import the name either.
        expect(code).not.toMatch(/\bKeyboardAvoidingView\b/);
      });
    });
  }
});
