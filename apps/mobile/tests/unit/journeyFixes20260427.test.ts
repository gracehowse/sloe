/**
 * Journey-architect 2026-04-27 sweep — pin the five correctness/parity
 * fixes flagged in `docs/audits/2026-04-27-journey-architect-app-wide.md`
 * and the related target-edit + Today-phase-3 specs. Source-string pins
 * mirror the existing parity tests (`cookAnalyticsParity.test.ts`,
 * `screenAuditFixesParity.test.ts`) — the mobile cook / discover /
 * verify / profile / Today screens use Expo Router + react-native
 * components that the vitest/jsdom env cannot render.
 *
 * Fixes covered:
 *   1. Cook mode "Log this meal" CTA on the done state (audit Top
 *      Broken Journey #1).
 *   2. Discover follows fetch wrapped in `useFocusEffect` so the
 *      Following filter reflects new follows on tab return (Top #4).
 *   3. Recipe verify navigates back to recipe detail after a
 *      successful save (Top #3).
 *   4. Profile target editor — `canSave` guard, unconditional `user`
 *      provenance stamp, Cancel button, dirty-flag write
 *      (`docs/specs/2026-04-27-mobile-target-edits-parity.md` P0-1 +
 *      P0-2 + P1-1 + P1-2).
 *   5. Eat-again banner REMOVED from the Today host on both mobile
 *      (`apps/mobile/app/(tabs)/index.tsx`) and web
 *      (`src/app/components/NutritionTracker.tsx`) — earlier phases only
 *      tuned its placement; the Sloe Figma-654:2 sweep retired the prompt
 *      entirely so the two surfaces match.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const COOK = resolve(__dirname, "../../app/cook.tsx");
const DISCOVER = resolve(__dirname, "../../app/(tabs)/discover.tsx");
const VERIFY = resolve(__dirname, "../../app/recipe/verify.tsx");
const PROFILE = resolve(__dirname, "../../app/profile.tsx");
const PROFILE_FLAG = resolve(__dirname, "../../lib/profileTargetsDirtyFlag.ts");
const TODAY = resolve(__dirname, "../../app/(tabs)/index.tsx");
const WEB_TRACKER = resolve(__dirname, "../../../../src/app/components/NutritionTracker.tsx");

const SRC = {
  cook: readFileSync(COOK, "utf8"),
  discover: readFileSync(DISCOVER, "utf8"),
  verify: readFileSync(VERIFY, "utf8"),
  profile: readFileSync(PROFILE, "utf8"),
  profileFlag: readFileSync(PROFILE_FLAG, "utf8"),
  today: readFileSync(TODAY, "utf8"),
  webTracker: readFileSync(WEB_TRACKER, "utf8"),
};

// ── Fix 1 — Cook-mode log CTA ─────────────────────────────────────────

describe("Fix 1 — cook mode 'Log this meal' CTA on done state", () => {
  it("renders the 'Log this meal' button in the isDone branch", () => {
    expect(SRC.cook).toMatch(/Log this meal/);
  });

  it("routes to /recipe/<id>?autoLog=1 so the recipe page's autoLog handler fires", () => {
    // The exact route shape the recipe detail screen consumes
    // (`useLocalSearchParams<{ autoLog?: string }>` at line 186).
    // 2026-04-30 (Paprika parity): the cook screen optionally appends
    // a `&portion=<scale>` suffix when the user has picked a non-1x
    // scale, so the regex tolerates an extra template-literal trailing
    // segment between `autoLog=1` and the closing backtick.
    expect(SRC.cook).toMatch(
      /router\.replace\(\s*`\/recipe\/\$\{recipeId\}\?autoLog=1[^`]*`/,
    );
  });

  it("guards against missing recipeId by falling back to router.back()", () => {
    // The CTA must not crash if the cook screen was opened without a
    // recipeId param (defensive — the Discover → recipe → cook chain
    // always provides one, but external deep links might not).
    expect(SRC.cook).toMatch(/if\s*\(\s*recipeId\s*\)\s*\{[\s\S]*?\}\s*else\s*\{\s*router\.back\(\)/);
  });

  it("fires `cook_mode_log_tapped` analytics on the CTA tap", () => {
    // Pairs with the recipe page's `food_logged` write so the funnel
    // tap → log → entry can be sliced in PostHog.
    expect(SRC.cook).toMatch(/track\(\s*AnalyticsEvents\.cook_mode_log_tapped\b/);
  });
});

// ── Fix 2 — Discover follows useFocusEffect ──────────────────────────

describe("Fix 2 — Discover follows fetch refreshes on tab focus", () => {
  it("uses useFocusEffect (not useEffect) for the follows fetch", () => {
    // Pre-fix, `useEffect([userId])` ran once per mount; following a
    // creator from the recipe-detail screen left the Following filter
    // empty until app restart.
    const followsBlock = SRC.discover.match(/setFollowedCreatorIds[\s\S]{0,2000}/);
    expect(followsBlock).not.toBeNull();
    const block = followsBlock?.[0] ?? "";
    expect(block).toMatch(/useFocusEffect\(/);
  });

  it("queries the follows table with the user's id", () => {
    expect(SRC.discover).toMatch(/from\(\s*["']follows["']\s*\)/);
    expect(SRC.discover).toMatch(/\.eq\(\s*["']user_id["']\s*,\s*userId\s*\)/);
  });

  it("imports useFocusEffect from @react-navigation/native (codebase convention)", () => {
    // Spec said `expo-router`; codebase convention is
    // `@react-navigation/native` (matches every other tab screen).
    // Both export the same hook; consistency wins.
    expect(SRC.discover).toMatch(
      /import\s*\{\s*useFocusEffect\s*\}\s*from\s*["']@react-navigation\/native["']/,
    );
  });
});

// ── Fix 3 — Verify post-save navigation ──────────────────────────────

describe("Fix 3 — Recipe verify routes to detail after successful save", () => {
  it("calls saveVerifiedIngredients then router.replace to the recipe detail", () => {
    // The save → replace order must be preserved: replace before save
    // resolves would route the user away from a half-finished write.
    const saveMatch = SRC.verify.match(/saveVerifiedIngredients[\s\S]{0,800}router\.replace/);
    expect(saveMatch).not.toBeNull();
  });

  it("only navigates on the success branch (error keeps the user on verify)", () => {
    // The "error" check returns early before router.replace fires;
    // pin both halves.
    expect(SRC.verify).toMatch(/if\s*\(\s*"error"\s+in\s+result\s*\)\s*\{[\s\S]{0,200}return;/);
    expect(SRC.verify).toMatch(/router\.replace\(\s*`\/recipe\/\$\{recipeId\}`/);
  });
});

// ── ENG-1066 — Visible Swap on verify rows (F-173) ───────────────────

describe("ENG-1066 — Recipe verify exposes visible Swap affordance", () => {
  it("collapsed ingredient rows render a Swap pill that opens food search", () => {
    expect(SRC.verify).toMatch(/<Text style=\{styles\.swapPillText\}>Swap<\/Text>/);
    expect(SRC.verify).toMatch(
      /accessibilityLabel=\{`Swap match for \$\{displayName\}`\}/,
    );
    expect(SRC.verify).toMatch(
      /setSearchIndex\(i\);[\s\S]{0,80}setExpandedIndex\(null\)/,
    );
    expect(SRC.verify).toMatch(/testID=\{`verify-ingredient-swap-\$\{i\}`\}/);
  });

  it("supports agent fixture deeplink without Supabase (fixture=1)", () => {
    expect(SRC.verify).toMatch(/VERIFY_FIXTURE_INGREDIENTS/);
    expect(SRC.verify).toMatch(/fixture === "1"/);
    expect(SRC.verify).toMatch(/testID="screen-recipe-verify-fixture"/);
  });
});

// ── Fix 4 — Profile target editor parity ─────────────────────────────

describe("Fix 4 — Profile target editor matches web parity", () => {
  it("computes a `canSave` guard (calories > 0 + all fields finite)", () => {
    // Mirrors web `Profile.tsx:257-267` exactly. Calories is parsed
    // into a local (`c`) and checked twice: `Number.isFinite(c)` and
    // `c > 0`. The other five fields are checked inline.
    expect(SRC.profile).toMatch(/const\s+canSave\s*=\s*useMemo/);
    expect(SRC.profile).toMatch(/const\s+c\s*=\s*Number\(calories\)/);
    expect(SRC.profile).toMatch(/Number\.isFinite\(\s*c\s*\)/);
    expect(SRC.profile).toMatch(/c\s*>\s*0/);
    expect(SRC.profile).toMatch(/Number\.isFinite\(\s*Number\(protein\)\s*\)/);
    expect(SRC.profile).toMatch(/Number\.isFinite\(\s*Number\(carbs\)\s*\)/);
    expect(SRC.profile).toMatch(/Number\.isFinite\(\s*Number\(fat\)\s*\)/);
    expect(SRC.profile).toMatch(/Number\.isFinite\(\s*Number\(fiber\)\s*\)/);
    expect(SRC.profile).toMatch(/Number\.isFinite\(\s*Number\(water\)\s*\)/);
  });

  it("the Save button is disabled when !canSave (or while saving)", () => {
    expect(SRC.profile).toMatch(/disabled=\{\s*!canSave\s*\|\|\s*saving\s*\}/);
  });

  it("save() returns early when !canSave", () => {
    // Defensive — keyboard "return" or programmatic invocation must
    // not bypass the visual disabled state.
    expect(SRC.profile).toMatch(/if\s*\(\s*!canSave\s*\)\s*return;/);
  });

  it("stamps `target_calories_source = 'user'` UNCONDITIONALLY on save", () => {
    // Pre-fix this was gated by `if (nextCalories != null)`. The bug:
    // typing `0` coerced via `Number(calories) || null` to `null`,
    // skipped the stamp, and silently kept the prior source value.
    // Now the stamp lives in the `profileData` object literal so it
    // is written on every successful save (canSave already guards
    // calories > 0).
    expect(SRC.profile).toMatch(/target_calories_source:\s*["']user["']/);
    expect(SRC.profile).toMatch(/target_calories_set_at:\s*new\s+Date\(\)\.toISOString\(\)/);
    // Make sure the legacy `if (nextCalories != null)` gate is gone.
    expect(SRC.profile).not.toMatch(/if\s*\(\s*nextCalories\s*!=\s*null\s*\)/);
  });

  it("writes raw `Number(calories)` (not `Number(calories) || null`) so 0 cannot pass canSave", () => {
    // The `|| null` coercion was the silent-data-loss vector. With
    // `canSave` guarding `> 0`, the upsert always carries a real
    // positive integer — no defensive coercion needed.
    expect(SRC.profile).toMatch(/target_calories:\s*Number\(calories\)\s*,/);
    expect(SRC.profile).not.toMatch(/target_calories:\s*Number\(calories\)\s*\|\|\s*null/);
  });

  it("renders a Cancel button alongside Save and reverts to the loaded snapshot", () => {
    // Cancel reads `loadedSnapshotRef` and resets every state value;
    // the snapshot is seeded on `loadProfile` and refreshed on a
    // successful save.
    expect(SRC.profile).toMatch(/loadedSnapshotRef\s*=\s*useRef</);
    expect(SRC.profile).toMatch(/const\s+cancel\s*=\s*useCallback/);
    expect(SRC.profile).toMatch(/onPress=\{\s*cancel\s*\}/);
    // Cancel resets every editable field.
    expect(SRC.profile).toMatch(/setDisplayName\(\s*snap\.displayName\s*\)/);
    expect(SRC.profile).toMatch(/setCalories\(\s*snap\.calories\s*\)/);
    expect(SRC.profile).toMatch(/setProtein\(\s*snap\.protein\s*\)/);
    expect(SRC.profile).toMatch(/setCarbs\(\s*snap\.carbs\s*\)/);
    expect(SRC.profile).toMatch(/setFat\(\s*snap\.fat\s*\)/);
    expect(SRC.profile).toMatch(/setFiber\(\s*snap\.fiber\s*\)/);
    expect(SRC.profile).toMatch(/setWater\(\s*snap\.water\s*\)/);
    expect(SRC.profile).toMatch(/setDietary\(\s*\[\.\.\.snap\.dietary\]\s*\)/);
  });

  it("writes the `suppr.profile.targets.dirty` flag after a successful upsert", () => {
    // Mobile fallback for the missing `setNutritionTargets` context
    // setter — Today's `useFocusEffect` reads + clears this flag.
    expect(SRC.profile).toMatch(
      /AsyncStorage\.setItem\(\s*PROFILE_TARGETS_DIRTY_KEY\s*,\s*["']1["']\s*\)/,
    );
    expect(SRC.profileFlag).toMatch(
      /export\s+const\s+PROFILE_TARGETS_DIRTY_KEY\s*=\s*["']suppr\.profile\.targets\.dirty["']/,
    );
  });

  it("Today tab clears the dirty flag on every focus", () => {
    // Today's existing per-focus `loadProfileTargets` already covers
    // the user-visible refresh; the flag clear is forward-defensive
    // and gives a single source of truth for "the user just edited
    // targets" should a future refactor short-circuit the unconditional
    // re-read.
    expect(SRC.today).toMatch(
      /import\s*\{\s*PROFILE_TARGETS_DIRTY_KEY\s*\}\s*from\s*["']@\/lib\/profileTargetsDirtyFlag["']/,
    );
    expect(SRC.today).toMatch(
      /AsyncStorage\.removeItem\(\s*PROFILE_TARGETS_DIRTY_KEY\s*\)/,
    );
  });
});

// ── Fix 5 — Eat-again removed from the Today host (both platforms) ───
//
// Earlier phases tuned the eat-again banner's PLACEMENT (above → below
// the hero). That whole prompt was then RETIRED from Today: mobile
// dropped it first (2026-05-22 "v4"), and web followed in the Sloe
// Figma-654:2 parity sweep (commit 664df1cb, 2026-06-04) so the two
// surfaces match — Today shows at most the north-star / deficit prompt,
// never a separate eat-again banner. This pins that BOTH composition
// roots stop rendering the banner (parity), so it can't silently return
// on one platform. (Web NutritionTracker's dead eat-again logic —
// `eatAgainSuggestion`, the dismiss-state hooks, and the
// `eatAgainDismiss` imports — was removed in the follow-up cleanup;
// mobile index.tsx still computes it for analytics/tests.)

describe("Fix 5 — Eat-again removed from Today host (web + mobile)", () => {
  it("mobile composition root no longer renders TodayEatAgainBanner", () => {
    expect(SRC.today).not.toContain("<TodayEatAgainBanner");
    expect(SRC.today).not.toContain("<TodayEatAgainScroller");
  });

  it("web NutritionTracker no longer renders the eat-again banner (parity)", () => {
    expect(SRC.webTracker).not.toContain("<TodayEatAgainBanner");
    expect(SRC.webTracker).not.toContain("<TodayEatAgainScroller");
  });
});
