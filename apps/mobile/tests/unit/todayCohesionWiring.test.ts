import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ENG-1065 (TF57 F-158 / F-159 / F-178 / F-179) — Today-cohesion source pins.
 *
 * The Today screen (`app/(tabs)/_today/TodayScreen.tsx`) is far too large to mount in a unit
 * test, so the host-side wiring of the three founder fixes is pinned by reading
 * the source. These break if a future edit unwires the section rhythm, the
 * empty-state flag gate, or the Complete-Day extraction.
 */
const read = (rel: string) => readFileSync(resolve(__dirname, rel), "utf8");

describe("Today cohesion — index.tsx host wiring", () => {
  const src = read("../../app/(tabs)/_today/TodayScreen.tsx");

  it("F-159 / ENG-1356: every page-ground section break collapsed to the ENG-1099 recipe-body rhythm (marginTop 0, one 24 scroll gap)", () => {
    // Meals, Weekly insight, Planned, Activity, Hydration all introduce on the
    // same cadence. ENG-1099 M1 flag-gated the break (`tierV1 ? 0 :
    // Layout.todaySectionBreak`); `today_tracker_tier_v1` was always-on in
    // production (REDESIGN_DEFAULT_ON) and was collapsed in ENG-1356 — the
    // break is now the unconditional `marginTop: 0` (the 24 Spacing.xl scroll
    // gap on `styles.scroll` carries the rhythm instead).
    const breaks = src.match(/marginTop:\s*0(?!\s*:)/g) ?? [];
    // 5 page-ground sections (Meals / Weekly insight / Planned / Activity /
    // Hydration). The Complete-Day section break lives in its extracted
    // component (TodayCompleteDayButton), not here.
    expect(breaks.length).toBeGreaterThanOrEqual(5);
    expect(src).not.toMatch(/tierV1/);
  });

  it("F-178/F-179: Planned card mounts when populated OR the empty-state flag is on", () => {
    expect(src).toMatch(/plannedMeals\.length > 0 \|\| isFeatureEnabled\("today_planned_empty_state"\)/);
  });

  it("F-158: Complete-Day is the extracted <TodayCompleteDayButton>, not an inline floating Pressable", () => {
    expect(src).toMatch(/import \{ TodayCompleteDayButton \}/);
    expect(src).toMatch(/<TodayCompleteDayButton/);
    // The old off-rhythm inline marginTop on the complete-day button is gone.
    expect(src).not.toMatch(/Complete Day<\/Text>\s*<\/Pressable>/);
  });
});

describe("Today cohesion — TodayMealsSection ENG-1099 M5 (collapsed ENG-1356)", () => {
  const src = read("../../components/today/TodayMealsSection.tsx");

  it("slot icon chip tint and log-usual pill use the quiet recipe-tier treatment unconditionally", () => {
    // `today_tracker_tier_v1` was always-on in production (REDESIGN_DEFAULT_ON)
    // and was collapsed in ENG-1356 — no flag check remains, only the tier-on
    // (quiet fill, no border) styling.
    expect(src).not.toMatch(/today_tracker_tier_v1/);
    expect(src).not.toMatch(/tierV1/);
    expect(src).toMatch(/backgroundColor: col \+ "12"/);
    expect(src).toMatch(/backgroundColor: colors\.fillQuiet/);
  });

  it("ENG-1099 M6: meal rows use PressableScale when tierV1 is on", () => {
    expect(src).toMatch(/TodayMealRowPressable/);
    expect(src).toMatch(/TodayLogUsualPressable/);
    expect(src).toMatch(/PressableScale haptic="selection"/);
  });

  it("ENG-1139: meal rows expose accessibilityRole + recipe-title label for VoiceOver", () => {
    expect(src).toMatch(
      /TodayMealRowPressable[\s\S]{0,200}accessibilityRole="button"[\s\S]{0,80}accessibilityLabel=\{m\.recipeTitle\}/,
    );
  });
});

describe("Today cohesion — TodayHeroRing ENG-1099 RC-3", () => {
  const src = read("../../components/today/TodayHeroRing.tsx");

  it("ENG-1342: macro-rings toggle always uses PressableScale haptic selection", () => {
    expect(src).toMatch(/today-macro-rings-toggle/);
    expect(src).toMatch(/PressableScale/);
    expect(src).toMatch(/haptic="selection"/);
    expect(src).not.toMatch(/tierV1 \?[\s\S]{0,120}today-macro-rings-toggle/);
  });
});

describe("Today cohesion — NorthStarBlock ENG-1099 RC-4 (collapsed ENG-1356)", () => {
  const src = read("../../components/today/NorthStarBlock.tsx");
  // ENG-1293/1301: the figma hero card was extracted into NorthStarFigmaHero.
  const heroSrc = read("../../components/today/NorthStarFigmaHero.tsx");

  it("uses on-family sage tokens for the band-tight chip unconditionally", () => {
    // `today_tracker_tier_v1` was always-on in production and was collapsed
    // in ENG-1356 — no flag check remains, only the tier-on sage tokens.
    expect(src).not.toMatch(/today_tracker_tier_v1/);
    expect(src).toMatch(/Accent\.success \+ "1A"/);
    expect(src).toMatch(/Accent\.successSolid/);
  });

  it("ENG-1099 RC-3: figma hero card uses PressableScale haptic selection", () => {
    expect(heroSrc).toMatch(/PressableScale[\s\S]{0,200}haptic="selection"[\s\S]{0,200}styles\.figmaHeroCard/);
  });
});

describe("Today cohesion — TodayCompleteDayButton component (collapsed ENG-1356)", () => {
  const src = read("../../components/today/TodayCompleteDayButton.tsx");

  it("F-158: anchors the CTA in a section wrapper on the standard rhythm", () => {
    // `today_tracker_tier_v1` was always-on in production and was collapsed
    // in ENG-1356 — the wrapper's marginTop is now the unconditional 0.
    expect(src).not.toMatch(/today_tracker_tier_v1/);
    expect(src).toMatch(/marginTop:\s*0/);
  });

  it("is a SOLID primary CTA via SupprButton (ENG-1079 — was outline)", () => {
    expect(src).toMatch(/<SupprButton[\s\S]{0,120}variant="primary"/);
    expect(src).not.toMatch(/backgroundColor:\s*"transparent"[\s\S]{0,120}borderColor:\s*accent\.primarySolid/);
  });

  it("preserves the HealthKit nutrition auto-export side-effect on press", () => {
    expect(src).toMatch(/isHealthSyncAvailable\(\)/);
    expect(src).toMatch(/exportDayToHealth\(userId, dk\)/);
  });
});
