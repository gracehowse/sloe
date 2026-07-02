// @vitest-environment jsdom
/**
 * Cook handsfree feature-flag pin (PR 5, 2026-05-01).
 *
 * The v1 cook-handsfree shell ships dark by default — the audio
 * listener is queued for v2, so users tapping the toggle would see
 * nothing happen and conclude the app is broken (journey-architect
 * P1 friction risk).
 *
 * This test pins:
 *   1. `COOK_HANDSFREE_FEATURE_ENABLED` defaults to `false` when no
 *      `EXPO_PUBLIC_COOK_HANDSFREE_ENABLED` env var is set.
 *   2. The flag flips to `true` when the env var is `"true"`.
 *      (Reload-required — the flag is read once at module load. We
 *      verify the boolean-coercion logic, not a live re-read.)
 *   3. The cook screen renders the toggle when the flag is true and
 *      a same-size invisible spacer when false (so the centered step
 *      counter stays visually centred either way).
 *
 * Item (3) is asserted at the source-level — the cook screen uses
 * Expo Router + expo-keep-awake + react-native modules that the
 * jsdom render path can't fully exercise (see
 * `cookAnalyticsParity.test.ts` for the same approach).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "../../../..");

function read(relPath: string): string {
  return readFileSync(resolve(REPO_ROOT, relPath), "utf8");
}

describe("cook handsfree feature flag — v1 shell ships dark by default", () => {
  it("`COOK_HANDSFREE_FEATURE_ENABLED` defaults to false at module load", async () => {
    // The lib reads the env var once at import time. We can't re-mock
    // process.env after the fact (vite-node caches the module) — but
    // we can read the pre-imported value from a fresh import in this
    // pristine test process.
    const mod = await import("../../lib/cookHandsfree");
    expect(mod.COOK_HANDSFREE_FEATURE_ENABLED).toBe(false);
  });

  it("the flag is wired to `EXPO_PUBLIC_COOK_HANDSFREE_ENABLED === \"true\"`", () => {
    const src = read("apps/mobile/lib/cookHandsfree.ts");
    expect(src).toMatch(/COOK_HANDSFREE_FEATURE_ENABLED/);
    expect(src).toMatch(
      /process\.env\.EXPO_PUBLIC_COOK_HANDSFREE_ENABLED\s*===\s*["']true["']/,
    );
  });

  it("cook.tsx imports `COOK_HANDSFREE_FEATURE_ENABLED` from the lib", () => {
    const src = read("apps/mobile/app/cook.tsx");
    expect(src).toMatch(
      /import\s*\{[^}]*COOK_HANDSFREE_FEATURE_ENABLED[^}]*\}\s*from\s*["']@\/lib\/cookHandsfree["']/,
    );
  });

  it("the toggle JSX is wrapped in a `COOK_HANDSFREE_FEATURE_ENABLED ? ... : <spacer />` ternary", () => {
    const cook = read("apps/mobile/app/cook.tsx");
    const panelUi = read("apps/mobile/hooks/useCookIngredientPanelUi.tsx");
    // The toggle Pressable is rendered when the flag is true.
    expect(cook).toMatch(
      /COOK_HANDSFREE_FEATURE_ENABLED\s*\?[\s\S]+?testID="cook-handsfree-toggle"/,
    );
    // Spacer (header balance) lives in the ingredient-panel hook when handsfree is off.
    expect(panelUi).toMatch(/testID="cook-handsfree-toggle-placeholder"/);
  });

  it("the AsyncStorage hydration effect short-circuits when the flag is off", () => {
    const src = read("apps/mobile/app/cook.tsx");
    // The `useEffect` that calls `readHandsfreeEnabled()` has an early
    // return guarded on the flag.
    expect(src).toMatch(
      /if\s*\(\s*!\s*COOK_HANDSFREE_FEATURE_ENABLED\s*\)\s*return\s*;[\s\S]+?readHandsfreeEnabled\(\)/,
    );
  });

  it("documents the journey-architect rationale in the source", () => {
    const src = read("apps/mobile/lib/cookHandsfree.ts");
    // Pin the comment so a future reader can see why the default is
    // OFF before flipping it.
    expect(src).toMatch(/journey-architect|broken|kill-switch|v1 shell|listener|v2/i);
  });
});
