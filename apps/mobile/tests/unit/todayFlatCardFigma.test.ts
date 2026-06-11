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
  it("light material is the §1 inversion: white cards on the cream brand ground (2026-06-10)", () => {
    // Fresh-eyes §1+§2: ground #FBF8F3 (the splash/onboarding cream) with
    // WHITE cards — the old white-ground/cream-card pairing differed by ~3
    // RGB points and never registered as a system. Supersedes the Figma
    // 654:2 surface.card cream-fill pin.
    expect(Colors.light.background).toBe("#FBF8F3");
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

  // TodayHeroRing is the SOFT reference (the lift every page-ground card now
  // matches under the one-treatment rule, Grace 2026-06-09).
  it("components/today/TodayHeroRing.tsx uses lift=\"soft\" (the page-ground reference)", () => {
    const src = readFileSync(
      join(ROOT, "components/today/TodayHeroRing.tsx"),
      "utf8",
    );
    expect(src).toMatch(/<SupprCard[\s\S]*?lift="soft"/);
    // Guard: must NOT revert to flat (that was the pre-one-treatment state that
    // made the top of Today read as one undifferentiated slab).
    expect(src).not.toMatch(/<SupprCard[\s\S]*?lift="flat"/);
  });

  // Page-ground Today cards — each sits directly on the scroll background, so
  // under the one-treatment rule (Grace 2026-06-09) they take the SOFT lift,
  // matching the hero reference. (TodayDashboardMacroTiles is NOT here — the
  // 2×2 macro tiles are the `size="tile"` exception that stays flat; pinned
  // separately below.)
  const TODAY_SOFT_PAGE_GROUND_SURFACES = [
    "components/today/TodayMealsSection.tsx",
    "components/today/TodayMealsFigmaLayout.tsx",
    "components/today/TodayPlannedMealsCard.tsx",
    "components/today/TodayActivityBonusCard.tsx",
    "components/today/TodayActivityCard.tsx",
    "components/today/NorthStarBlock.tsx",
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
