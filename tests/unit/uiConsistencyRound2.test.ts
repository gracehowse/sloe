/**
 * Polish (2026-04-26) — UI consistency round 2 contract pins.
 *
 * Round 1 closed 9 of the 28 audit items. Round 2 actions the remaining
 * 19 — some were render-only fixes (single-line edits), some were no-ops
 * after closer inspection (audit assumptions wrong on closer reading).
 * This file pins the structural fixes so they cannot regress quietly.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(__dirname, "..", "..");
const read = (rel: string) => readFileSync(resolve(REPO, rel), "utf8");

describe("Round 2 — text / casing fixes", () => {
  it("D23: 'Make this your usual snacks' uses Title Case slot label", () => {
    const SRC = read("apps/mobile/components/today/TodayMealsSection.tsx");
    expect(SRC).toMatch(/Make this your usual \{slot\}\./);
    expect(SRC).not.toMatch(/Make this your usual \{slot\.toLowerCase\(\)\}/);
  });

  it("D17: nutrients link migrated into the macro tiles header (Top-5 #2C, 2026-04-28); no confusing count anywhere", () => {
    // Round 2 (2026-04-26) dropped a parenthesised count from the
    // "View all nutrients (N)" link. Top-5 #2C (2026-04-28, see
    // `docs/ux/teardown-2026-04-28-daily-loop.md`) went further:
    // the standalone centred link was moved out of the host
    // composition and into the macro-tiles section header as a
    // small right-aligned "Nutrients" chevron link, opened via
    // `showNutrientsLink` + `onPressNutrients` props on
    // TodayDashboardMacroTiles. The pin asserts both halves:
    // (1) the old "View all nutrients" string is gone from the
    // host file, and (2) the new "Nutrients" label exists inside
    // TodayDashboardMacroTiles.tsx. Neither file carries the
    // count-appended variant the original audit flagged.
    const HOST = read("apps/mobile/app/(tabs)/index.tsx");
    expect(HOST).not.toMatch(/View all nutrients/);
    expect(HOST).not.toMatch(/dayNutrientDetailRowsWithoutMacroDupes\.length\}\)/);

    const TILES = read("apps/mobile/components/today/TodayDashboardMacroTiles.tsx");
    expect(TILES).toMatch(/Nutrients\b\s*<\/Text>/);
    expect(TILES).not.toMatch(/Nutrients \(\{[^}]+\.length\}\)/);
  });

  it("D19: shopping list screen title is Sentence Case (matches other top-level screens)", () => {
    const SRC = read("apps/mobile/app/shopping.tsx");
    expect(SRC).toMatch(/styles\.headerTitle\}>Shopping list</);
    expect(SRC).not.toMatch(/styles\.headerTitle\}>SHOPPING LIST</);
  });
});

describe("Round 2 — layout fixes", () => {
  it("A8: Targets is in STACK_HEADER_HIDDEN so the duplicate auto-stack title is suppressed", () => {
    const SRC = read("apps/mobile/app/_layout.tsx");
    expect(SRC).toMatch(/"targets"/);
  });

  it("A7: Burn Detail is in STACK_HEADER_HIDDEN (closes duplicate back affordance)", () => {
    const SRC = read("apps/mobile/app/_layout.tsx");
    expect(SRC).toMatch(/"burn-detail"/);
  });

  it("A7: Burn Detail surfaces an empty state instead of an infinite Loading spinner", () => {
    const SRC = read("apps/mobile/app/burn-detail.tsx");
    expect(SRC).toMatch(/setLoadError/);
    expect(SRC).toMatch(/loadError/);
    // Either ActivityIndicator imported, or "Loading…" with a spinner.
    expect(SRC).toMatch(/ActivityIndicator/);
  });
});

describe("Round 2 — algorithm display fixes", () => {
  it("A5: legacy plan portion multipliers snap to {0.5, 1, 1.5, 2} at render", () => {
    const SRC = read("apps/mobile/app/(tabs)/planner.tsx");
    expect(SRC).toMatch(/snapDisplayMultiplier/);
    // The snap function rounds to nearest 0.5 and clamps to [0.5, 2].
    expect(SRC).toMatch(/Math\.round\(raw \* 2\) \/ 2/);
    expect(SRC).toMatch(/Math\.min\(2, Math\.max\(0\.5/);
  });

  it("D16: weight-tracker range pills reduced from 7 to 4", () => {
    const SRC = read("apps/mobile/components/charts/TimeRangeSelector.tsx");
    // Visible RANGES array — the canonical short list.
    expect(SRC).toMatch(/const RANGES: TimeRange\[\] = \["1M", "3M", "12M", "All"\]/);
  });
});

describe("Round 2 — colour token alignment", () => {
  it("D20: Recipe Detail uses MacroColors.fiber (not Accent.success direct ref) for fiber", () => {
    const SRC = read("apps/mobile/app/recipe/[id].tsx");
    // The macro map's fiber row references the canonical token.
    expect(SRC).toMatch(/fiber:\s*\{\s*label:\s*"Fiber"[^}]*color:\s*MacroColors\.fiber/);
  });
});

describe("Round 2 — copy / discoverability", () => {
  it("D22: confidence row labels the percentage so 35% / 98% are self-explanatory", () => {
    const SRC = read("apps/mobile/app/recipe/[id].tsx");
    expect(SRC).toMatch(/\{confPct\}% · \{confLabel\}/);
  });

  it("D21: Progress page weight card header is Sentence Case (matches Daily Calories / Macro Adherence)", () => {
    const SRC = read("apps/mobile/app/(tabs)/progress.tsx");
    // The new header reads "Weight" not "WEIGHT".
    expect(SRC).toMatch(/>Weight<\/Text>/);
    expect(SRC).not.toMatch(/textTransform: "uppercase" \}}>WEIGHT</);
  });
});

describe("Round 2 — destructive action escalation", () => {
  it("B13: 'Delete my account' is its own row (M15/M16 fix), not stacked inside the reset modal", () => {
    const SRC = read("apps/mobile/app/(tabs)/more.tsx");
    // M15/M16 fix (audit 2026-04-28): the previous "Delete my
    // account permanently" button was the third destructive action
    // inside the reset/erase modal — too easy to misclick. Account
    // deletion now lives in its own SettingsRow (icon=Trash2,
    // iconColor=t.red, label="Delete my account") with a deliberate
    // two-step confirm flow that requires typing 'delete'.
    expect(SRC).toMatch(/label="Delete my account"/);
    // The ghost-button-inside-the-modal pattern is gone.
    expect(SRC).not.toContain("Delete my account permanently");
    // The new flow's "type delete" confirmation must be present.
    expect(SRC).toMatch(/Type 'delete' to confirm/);
  });
});

describe("Round 2 — design-tokens documentation", () => {
  it("docs/ux/design-tokens.md exists and codifies the canonical patterns", () => {
    const SRC = read("docs/ux/design-tokens.md");
    expect(SRC).toMatch(/UPPERCASE micro eyebrows/);
    expect(SRC).toMatch(/Sentence Case bold/);
    expect(SRC).toMatch(/Destructive escalation hierarchy/);
    expect(SRC).toMatch(/Onboarding exception/);
    expect(SRC).toMatch(/Audit checklist for new PRs/);
  });
});

describe("Round 2 follow-through — D25 inline strip empty-state gate (superseded by Phase 2 / B1.2)", () => {
  it("TodayQuickLogStrip is no longer rendered on Today (Phase 2 / B1.2 canonical Today)", () => {
    const SRC = read("apps/mobile/app/(tabs)/index.tsx");
    // Phase 2 / B1.2 (2026-04-27, D-2026-04-27-15): the canonical
    // Today removes the QuickLogStrip from the composition root in
    // favour of the persistent <LogFab>. This test was previously
    // pinning the empty-day-only gate (D25); the gate is now moot
    // because the strip is no longer rendered at all. The assertion
    // is inverted to pin the new direction — if a future contributor
    // accidentally re-introduces <TodayQuickLogStrip /> on Today this
    // test will fail.
    //
    // The component file is intentionally still imported by the
    // legacy variant test; we only assert the JSX render call is
    // gone, not the import.
    expect(SRC).not.toMatch(/<TodayQuickLogStrip[\s\S]+?\/>/);
  });
});
