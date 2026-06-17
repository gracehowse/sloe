import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderHook } from "@testing-library/react-native";
import { vi } from "vitest";

const ROOT = join(__dirname, "../..");

const themeState: { resolved: "light" | "dark"; colors: Record<string, string> } = {
  resolved: "light",
  colors: { cardElevated: "#2A2730", card: "#F6F5F2" },
};
vi.mock("@/context/theme", () => ({
  useTheme: () => themeState,
}));

// eslint-disable-next-line import/first
import { useTodayCardElevation } from "../../hooks/useCardElevation";
import { Colors, Elevation } from "../../constants/theme";

describe("Today one-treatment elevation (Grace 2026-06-09)", () => {
  // ONE treatment per surface (Grace 2026-06-09): every card sitting directly
  // on the Today scroll ground takes the SOFT lift; only cards NESTED inside
  // another card (inset tiles, rows inside a sheet) stay flat — a card-in-a-card
  // must not double-shadow. This guard pins the page-ground cards to SOFT; the
  // exceptions (macro tiles, hero) are pinned explicitly below.
  it("light material is the §1 inversion: white cards on a DEEPENED cream ground (2026-06-16)", () => {
    // Fresh-eyes §1+§2: WHITE cards on a cream ground — the old white-ground/
    // cream-card pairing differed by ~3 RGB points and never registered.
    // 2026-06-16 (Natural Cycles / Withings study): the working ground deepened
    // a gentle step #FBF8F3 → #F3F0E8 (L*≈98 → ≈95, a ~5 L* gap) so the flat-card
    // grammar separates without reading dark (a first pass to #EFE8DA/L*≈92 was
    // too dark). Splash/icon ground stays #FBF8F3 (app.json, brandIconSplash.
    // test.ts). See docs/decisions/2026-06-16-deepen-ground-for-flat-cards.md.
    expect(Colors.light.background).toBe("#F3F0E8");
    expect(Colors.light.card).toBe("#FFFFFF");
    expect(Colors.light.cardElevated).toBe("#FFFFFF");
  });

  it("useTodayCardElevation (the named flat wrapper, still the hook flat contract) drops shadow and border in light mode", () => {
    // The wrapper itself is unchanged — it is the SYSTEM contract for the flat
    // variant. Page-ground call sites now opt INTO soft; the flat wrapper stays
    // available for the nested/tile surfaces that must not double-shadow.
    themeState.resolved = "light";
    const { result } = renderHook(() => useTodayCardElevation());
    expect(result.current.shadowStyle).toBeUndefined();
    expect(result.current.useBorder).toBe(false);
    expect(result.current.liftBg).toBeUndefined();
  });

  // ENG-1099 (Grace 2026-06-14, "flatten all"): the TRACKER-HALF cards
  // (hero ring, meal slots, north-star) flatten to recipe-screen grammar behind
  // `today_tracker_tier_v1` — superseding the 2026-06-09 soft-lift for these
  // three. The flag-gated form (`lift={... today_tracker_tier_v1? "flat":"soft"}`)
  // keeps the soft path alive in the else. The OTHER page-ground cards (below the
  // tracker half) stay soft — ENG-1099 is scoped to the tracker half.
  const TODAY_TIER_FLAGGED_SURFACES = [
    "components/today/TodayHeroRing.tsx",
    "components/today/TodayMealsSection.tsx",
    "components/today/NorthStarBlock.tsx",
  ];

  it.each(TODAY_TIER_FLAGGED_SURFACES)(
    "%s flag-gates its SupprCard lift on today_tracker_tier_v1 (ENG-1099 flat, soft in the else)",
    (relPath) => {
      const src = readFileSync(join(ROOT, relPath), "utf8");
      expect(src).toMatch(/today_tracker_tier_v1/);
      expect(src).toMatch(/lift=\{[\s\S]*?"flat"[\s\S]*?"soft"/);
    },
  );

  // Page-ground Today cards BELOW the tracker half — each sits directly on the
  // scroll background and stays on the SOFT lift (one-treatment rule, Grace
  // 2026-06-09; not in ENG-1099's tracker-half scope). (TodayDashboardMacroTiles
  // is NOT here — the 2×2 tiles are the `size="tile"` flat exception.)
  const TODAY_SOFT_PAGE_GROUND_SURFACES = [
    // TodayMealsFigmaLayout.tsx removed 2026-06-17 (ENG-1096 — dead off-by-
    // default summary layout deleted; the live per-slot list lives in
    // TodayMealsSection.tsx, pinned by todayMealsSectionTd4).
    "components/today/TodayPlannedMealsCard.tsx",
    "components/today/TodayActivityBonusCard.tsx",
    "components/today/TodayActivityCard.tsx",
    "components/today/WeeklyCheckinBanner.tsx",
    "components/today/TodayFirstMealEmptyState.tsx",
    "components/today/TodayDashboardMacroBars.tsx",
    // WeeklyInsightCard removed 2026-06-10 — de-carded into a typographic
    // callout (fresh-eyes §3); pinned separately below.
    "components/HydrationStimulantsCard.tsx",
  ];

  it.each(TODAY_SOFT_PAGE_GROUND_SURFACES)(
    "%s uses lift=\"soft\" on its page-ground SupprCard (one-treatment, Grace 2026-06-09)",
    (relPath) => {
      const src = readFileSync(join(ROOT, relPath), "utf8");
      expect(src).toMatch(/<SupprCard[\s\S]*?lift="soft"/);
    },
  );

  // ENG-1014 — macro tiles delegate to MacroStatTile (shared leaf), not SupprCard.
  it("TodayDashboardMacroTiles renders MacroStatTile per tracked macro (ENG-1014)", () => {
    const src = readFileSync(
      join(ROOT, "components/today/TodayDashboardMacroTiles.tsx"),
      "utf8",
    );
    expect(src).toMatch(/import \{ MacroStatTile \}/);
    expect(src).toMatch(/<MacroStatTile/);
    expect(src).not.toMatch(/from ["']@\/components\/ui\/SupprCard["']/);
  });

  // The two below-hero cards Grace flagged as inconsistent (2026-06-08). They
  // are now flat `SupprCard` slabs like every other resting Today card — these
  // assertions fail if either reverts to a hand-rolled bordered `<View>` with
  // an inline tint (the exact drift that was fixed: WeeklyCheckinBanner's peach
  // `${Accent.primary}08` + clay border, WeeklyInsightCard's `rgba(237,234,…)`).
  it("WeeklyCheckinBanner is a soft SupprCard with no hand-rolled card border", () => {
    const src = readFileSync(
      join(ROOT, "components/today/WeeklyCheckinBanner.tsx"),
      "utf8",
    );
    // Soft page-ground lift under the one-treatment rule (Grace 2026-06-09).
    expect(src).toMatch(/<SupprCard[\s\S]*?lift="soft"/);
    // No rogue card-surface border/tint on the outer wrapper. (The clay OPEN
    // button keeps its own `backgroundColor: Accent.primary` — that's a CTA,
    // not the card surface — so we only forbid the banner-tint pattern.)
    expect(src).not.toMatch(/backgroundColor:\s*`\$\{Accent\.primary\}08`/);
    expect(src).not.toMatch(/borderColor:\s*`\$\{Accent\.primary\}30`/);
  });

  it("WeeklyInsightCard is a de-carded typographic callout (fresh-eyes §3, 2026-06-10)", () => {
    const src = readFileSync(
      join(ROOT, "components/today/WeeklyInsightCard.tsx"),
      "utf8",
    );
    // On the §1 inverted material the lilac slab read as the odd muddy box
    // between white gallery cards — the insight now sits directly on the
    // cream ground as eyebrow + prose. No card shell, no lilac tone, and
    // the old hand-rolled tints must not return.
    expect(src).not.toMatch(/<SupprCard/);
    expect(src).not.toMatch(/tone="magenta"/);
    expect(src).not.toMatch(/rgba\(237,\s*234,\s*241/);
    expect(src).not.toContain("figmaInsightCard");
  });

  it("index.tsx styles.card uses the soft page-ground lift (one-treatment, Grace 2026-06-09)", () => {
    // `styles.card` is the Today top-level resting-card style — it sits on the
    // page (scroll) ground, so it now takes the soft variant, matching every
    // other page-ground Today card. (Was `useTodayCardElevation()` flat.)
    const src = readFileSync(join(ROOT, "app/(tabs)/index.tsx"), "utf8");
    expect(src).toMatch(/useCardElevation\(\{\s*variant:\s*"soft"\s*\}\)/);
    expect(src).not.toContain("useTodayCardElevation");
  });

  it("index.tsx styles.card uses CARD_RADIUS (24px)", () => {
    const src = readFileSync(join(ROOT, "app/(tabs)/index.tsx"), "utf8");
    expect(src).toMatch(/card:\s*\{[\s\S]*?borderRadius:\s*CARD_RADIUS/);
  });

  const TODAY_SUPPR_CARD_SHAPE_SURFACES = [
    "components/today/TodayFirstMealEmptyState.tsx",
    "components/today/TodayDashboardMacroBars.tsx",
    // WeeklyInsightCard removed 2026-06-10 — de-carded (fresh-eyes §3).
  ];

  it.each(TODAY_SUPPR_CARD_SHAPE_SURFACES)(
    "%s uses SupprCard lift=\"soft\" for 24px corners (page-ground, one-treatment Grace 2026-06-09)",
    (relPath) => {
      const src = readFileSync(join(ROOT, relPath), "utf8");
      expect(src).toMatch(/<SupprCard[\s\S]*?lift="soft"/);
      expect(src).not.toMatch(/borderRadius:\s*Radius\.(lg|xl)/);
    },
  );

  it("TodayQuickLogStrip chips use CARD_RADIUS", () => {
    const src = readFileSync(
      join(ROOT, "components/today/TodayQuickLogStrip.tsx"),
      "utf8",
    );
    expect(src).toMatch(/borderRadius:\s*CARD_RADIUS/);
  });

  it("flat lift is the default; soft is the opt-in for elevated cards", () => {
    // The 2026-06-04 "flat slabs" sweep (commit 664df1cb) made FLAT the hook
    // (and SupprCard) default — Today is no longer the lone flat exception.
    // Soft is now requested explicitly by the elevated recipe-card surfaces
    // (Discover, Library, recipe detail) and still carries a real ambient lift.
    const hookSrc = readFileSync(
      join(ROOT, "hooks/useCardElevation.ts"),
      "utf8",
    );
    expect(hookSrc).toContain('variant ?? "flat"');
    expect(Elevation.cardSoft.shadowOpacity).toBeGreaterThan(0);
  });
});
