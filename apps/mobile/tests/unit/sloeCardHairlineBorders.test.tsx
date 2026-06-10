/**
 * Sloe resting-card chrome — hairline edge, and (2026-06-04) consolidated onto
 * the shared <SupprCard> shell.
 *
 * ROOT CAUSE this guards: the Sloe resting cards set `borderWidth: 1`, which is
 * 1 *logical* pt = 3 *physical* px on a @3x phone — far heavier than the
 * prototype's subtle `border border-line` (a 1px CSS border inside a ~500px
 * frame). The fix swaps the literal `1` for `StyleSheet.hairlineWidth` (≈1
 * physical px). For the surfaces consolidated onto <SupprCard> (Grace
 * 2026-06-04 "each card looks slightly different — they should all be the same
 * component"), the hairline now lives INSIDE the shell — so those files no
 * longer hand-roll the `useBorder ? … : 0` chrome at all; they route through
 * <SupprCard>. The remaining hand-rolled resting cards keep their hairline pin.
 *
 * Reference: `docs/prototypes/stitch-sloe/_buildtoday.mjs` /
 * `_buildtoday-sections.mjs` — every card is `border border-line`, every
 * divider is `divide-x divide-line` / `border-t border-line` (1 CSS px).
 *
 * WHY THIS IS A SOURCE-LEVEL SWEEP (not a render/value test):
 * `StyleSheet.hairlineWidth` resolves to a *sub-pixel* value on a real @3x
 * device, but the react-native mock under vitest reports it as `1`. A
 * rendered-value assertion can't distinguish hairline from the heavy `1` literal
 * (both === 1 in the test env). So we pin the *source intent* instead — exactly
 * the pattern `slotColorTokensParity.test.ts` uses.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MOBILE_ROOT = resolve(__dirname, "../..");

function read(relPath: string): string {
  return readFileSync(resolve(MOBILE_ROOT, relPath), "utf8");
}

describe("the shared <SupprCard> shell owns the hairline edge", () => {
  // The hairline lives in ONE place now — the shell — so it can never drift
  // back to a heavy 1pt box per-card. The shell draws the border as
  // `StyleSheet.hairlineWidth`, gated by `showBorder` (so the light soft-lift
  // drops it, dark/inset keeps it). The heavy `: 1` form must not appear.
  const shell = read("components/ui/SupprCard.tsx");

  it("draws the border as StyleSheet.hairlineWidth", () => {
    expect(shell).toMatch(/showBorder\s*\?\s*StyleSheet\.hairlineWidth\s*:\s*0/);
  });

  it("never uses a heavy 1pt resting border", () => {
    expect(shell).not.toMatch(/borderWidth:\s*1\b(?!\s*\?)/);
    expect(shell).not.toMatch(/\?\s*1\s*:\s*0/);
  });
});

describe("resting cards CONSOLIDATED onto <SupprCard> (2026-06-04)", () => {
  // These card surfaces were hand-rolling the `useBorder ? hairlineWidth : 0`
  // chrome (and drifting on radius/fill/clip). They now route through the shell.
  // So the guard flips: they MUST import + render <SupprCard>, and MUST NOT
  // hand-roll the resting-card border chrome themselves.
  const MIGRATED = [
    "components/today/TodayHeroRing.tsx",
    "components/today/TodayDashboardMacroTiles.tsx",
    "components/today/TodayPlannedMealsCard.tsx",
    "components/today/TodayMealsSection.tsx",
    "components/today/TodayDashboardMacroBars.tsx",
    "components/today/TodayFirstMealEmptyState.tsx",
    "components/HydrationStimulantsCard.tsx",
    "components/progress/TrajectoryCard.tsx",
    "components/progress/TrendSummaryCard.tsx",
    "components/progress/DigestStoryCard.tsx",
  ];

  it.each(MIGRATED)("%s renders card chrome through <SupprCard>", (relPath) => {
    const src = read(relPath);
    expect(src).toMatch(/from ["']@\/components\/ui\/SupprCard["']/);
    expect(src).toMatch(/<SupprCard/);
  });

  // All but HydrationStimulantsCard must have ZERO heavy `useBorder ? 1 : 0` —
  // the resting-card chrome moved into the shell. HydrationStimulants keeps
  // EXACTLY ONE: its reset-menu *modal* (a floating dialog over a scrim, not a
  // resting card on the page), checked separately below.
  it.each(MIGRATED.filter((f) => !f.includes("HydrationStimulantsCard")))(
    "%s no longer hand-rolls the `useBorder ? 1 : 0` resting border",
    (relPath) => {
      expect(read(relPath)).not.toMatch(/useBorder\s*\?\s*1\s*:\s*0/);
    },
  );

  it("HydrationStimulantsCard keeps EXACTLY ONE heavy `useBorder ? 1 : 0` — its reset-menu modal", () => {
    // The SloeCard resting shell is now <SupprCard> (asserted above). The only
    // heavy form left is the reset-menu dialog; if a resting card ever regresses
    // here, this count climbs to 2 and fails.
    const heavy = read("components/HydrationStimulantsCard.tsx").match(
      /useBorder\s*\?\s*1\s*:\s*0/g,
    );
    expect(heavy).not.toBeNull();
    expect(heavy!.length).toBe(1);
  });
});

describe("resting cards STILL hand-rolled — hairline edge, not a heavy 1pt", () => {
  // Surfaces not yet migrated to the shell (tracked follow-up — see the
  // "Recipes tab not migrated this pass" section of
  // docs/decisions/2026-06-04-card-component-consolidation.md). Until they
  // migrate, they must still draw a hairline, never a 1pt box.
  const HAND_ROLLED = [
    "app/(tabs)/index.tsx", // styles.card — legacy 3.4k-line screen shell
    "components/today/ProgressHeadline.tsx",
    "components/today/ProgressStoryGate.tsx",
    "components/RemainingMacrosBar.tsx",
  ];

  it.each(HAND_ROLLED)(
    "%s draws its resting-card border as StyleSheet.hairlineWidth (never `useBorder ? 1 : 0`)",
    (relPath) => {
      const src = read(relPath);
      expect(src).not.toMatch(/useBorder\s*\?\s*1\s*:\s*0/);
      expect(src).toMatch(/useBorder\s*\?\s*StyleSheet\.hairlineWidth\s*:\s*0/);
    },
  );
});

describe("TodayActivityBonusCard — Figma TD1 sibling page-ground slabs", () => {
  const src = read("components/today/TodayActivityBonusCard.tsx");

  it("renders energy balance, burn breakdown, and 7-day rolling as separate <SupprCard lift='soft'> sibling slabs", () => {
    // One-treatment rule (Grace 2026-06-09): all three blocks are sibling cards
    // sitting on the Today scroll ground, so they take the SOFT lift (matching
    // the hero reference), not flat. No nested inset sub-panels.
    expect(src).toMatch(/from ["']@\/components\/ui\/SupprCard["']/);
    expect(src).toMatch(/testID="today-energy-balance-card"/);
    expect(src).toMatch(/testID="today-burn-breakdown-card"/);
    expect(src).toMatch(/testID="today-weekly-rolling-card"/);
    expect(src).toMatch(/lift="soft"/);
    // The dead flat direction must not come back for these page-ground slabs.
    expect(src).not.toMatch(/lift="flat"/);
    expect(src).toMatch(/Layout\.todaySectionCardGap/);
    // No nested inset sub-panels — each block is its own top-level soft card.
    expect(src).not.toMatch(/size="inset"/);
  });

  it("no longer hardcodes a `borderWidth: 1,` or `borderRadius: 20` resting card", () => {
    // The old hand-rolled inner cards used a literal `borderRadius: 20` +
    // hairline; that chrome moved into the shell. The only `useBorder ? 1 : 0`
    // left is the TDEE explainer *modal* (a floating dialog, out of scope).
    expect(src).not.toMatch(/borderWidth:\s*1,/);
    expect(src).not.toMatch(/borderRadius:\s*20\b/);
  });
});

describe("Sloe structural dividers — hairline, not a 1pt rule (still hand-rolled inside cards)", () => {
  it("TodayHeroRing stats-row top-divider + per-cell divide-x are hairline", () => {
    const src = read("components/today/TodayHeroRing.tsx");
    expect(src).toMatch(/borderTopWidth:\s*StyleSheet\.hairlineWidth/);
    expect(src).not.toMatch(/borderTopWidth:\s*1,/);
    expect(src).toMatch(
      /borderLeftWidth:\s*dividerColor\s*\?\s*StyleSheet\.hairlineWidth\s*:\s*0/,
    );
    expect(src).not.toMatch(/borderLeftWidth:\s*dividerColor\s*\?\s*1\s*:\s*0/);
  });

  it("TodayActivityCard steps/active divider is a hairline-tall View (not height:1)", () => {
    const src = read("components/today/TodayActivityCard.tsx");
    expect(src).toMatch(/height:\s*StyleSheet\.hairlineWidth,\s*backgroundColor:\s*borderColor/);
    expect(src).not.toMatch(/height:\s*1,\s*backgroundColor:\s*borderColor/);
  });

  it("TodayActivityBonusCard summary-row top-divider + stat divide-x are hairline", () => {
    const src = read("components/today/TodayActivityBonusCard.tsx");
    expect(src).toMatch(/borderTopWidth:\s*StyleSheet\.hairlineWidth/);
    expect(src).not.toMatch(/borderTopWidth:\s*1,/);
    const verticalDividers = src.match(
      /width:\s*StyleSheet\.hairlineWidth,\s*backgroundColor:\s*borderColor/g,
    );
    expect(verticalDividers).not.toBeNull();
    expect(verticalDividers!.length).toBeGreaterThanOrEqual(2);
    expect(src).not.toMatch(/width:\s*1,\s*backgroundColor:\s*borderColor/);
  });

  it("HydrationStimulantsCard stacked-row divider is hairline", () => {
    const src = read("components/HydrationStimulantsCard.tsx");
    expect(src).toMatch(
      /borderTopWidth:\s*topBorder\s*\?\s*StyleSheet\.hairlineWidth\s*:\s*0/,
    );
    expect(src).not.toMatch(/borderTopWidth:\s*topBorder\s*\?\s*1\s*:\s*0/);
  });

  it("TodayMealsSection meal-row + action-row dividers are hairline", () => {
    const src = read("components/today/TodayMealsSection.tsx");
    expect(src).toMatch(/borderBottomWidth:\s*StyleSheet\.hairlineWidth/);
    expect(src).toMatch(/borderTopWidth:\s*StyleSheet\.hairlineWidth/);
    expect(src).not.toMatch(/borderBottomWidth:\s*1,\s*\n\s*borderBottomColor:\s*cardBorderColor/);
    expect(src).not.toMatch(/borderTopWidth:\s*1,\s*\n\s*borderTopColor:\s*cardBorderColor/);
  });
});
