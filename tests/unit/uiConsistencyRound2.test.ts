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
    // small right-aligned label opened via `showNutrientsLink` +
    // `onPressNutrients` props on TodayDashboardMacroTiles.
    //
    // The chip label was upgraded from "Nutrients >" to
    // "All nutrients >" so it reads as an action affordance.
    //
    // The pin asserts:
    //   (1) the old "View all nutrients" string is gone from host
    //   (2) the chip label "All nutrients" exists inside
    //       TodayDashboardMacroTiles.tsx
    //   (3) count-appended variant does not exist
    const HOST = read("apps/mobile/app/(tabs)/index.tsx");
    expect(HOST).not.toMatch(/View all nutrients/);
    expect(HOST).not.toMatch(/dayNutrientDetailRowsWithoutMacroDupes\.length\}\)/);

    const TILES = read("apps/mobile/components/today/TodayDashboardMacroTiles.tsx");
    expect(TILES).toMatch(/All nutrients\s*<\/Text>/);
    expect(TILES).not.toMatch(/All nutrients \(\{[^}]+\.length\}\)/);
    expect(TILES).not.toMatch(/Nutrients \(\{[^}]+\.length\}\)/);
  });

  it("D19: shopping list screen title is Sentence Case (matches other top-level screens)", () => {
    const SRC = read("apps/mobile/app/shopping.tsx");
    expect(SRC).toMatch(/title="Shopping list"/);
    expect(SRC).not.toMatch(/title="SHOPPING LIST"/);
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

  it("D16 / F-125: weight-tracker range pills match Progress tab canonical set", () => {
    const SRC = read("apps/mobile/components/charts/TimeRangeSelector.tsx");
    // F-125 (2026-05-07): RANGES now mirrors WeightRangeToggle's
    // 1W / 1M / 3M / 1Y / All set so the two surfaces don't disagree
    // on the available time windows. "12M" stays in the union for
    // backwards-compat persisted state; the visible label flips to
    // "1Y" via `rangeLabel()`.
    expect(SRC).toMatch(/const RANGES: TimeRange\[\] = \["1W", "1M", "3M", "12M", "All"\]/);
    expect(SRC).toMatch(/function rangeLabel\(r: TimeRange\): string \{[\s\S]*?"12M" \? "1Y" : r/);
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
  it("D22: confidence row uses categorical label only (no opaque % string)", () => {
    const SRC = read("apps/mobile/app/recipe/[id].tsx");
    // 2026-05-06 audit (F-120): tester quote — "Don't really
    // understand what 88% verified means it sounds made up."
    // Dropped the inline "{confPct}% · {tierLabel}" rendering;
    // categorical label alone reads cleaner ("Partial match" /
    // "Estimated" / "Unverified") and the row colour carries the
    // same semantic. The numeric confidence is still surfaced via
    // the long-press accessibility hint
    // ("Status: Partial match (88%)") for power users + screen
    // readers.
    //
    // Pin asserts: (a) the inline "%·label" form is GONE from the
    // visible Text node, and (b) the accessibilityHint pattern
    // still includes the percentage so screen-reader users keep
    // the precision.
    expect(SRC).not.toMatch(/\{confPct\}% · \{tierLabel\}/);
    expect(SRC).toMatch(/`Status: \$\{tierLabel\}\$\{confPct/);
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
    // Source moved (2026-04-29, Group G IA Batch B): the danger zone
    // now lives in `SettingsBundleContent`, mounted on both
    // `/(tabs)/more` and `/(tabs)/settings`. The original M15/M16 fix
    // — separating account-delete from the reset modal so it can't be
    // misclicked — is preserved verbatim in the bundle.
    const SRC = read(
      "apps/mobile/components/settings/SettingsBundleContent.tsx",
    );
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
