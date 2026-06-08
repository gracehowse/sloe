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

describe("Today flat borderless slab (Figma 654:2)", () => {
  it("light card fill matches Figma surface.card (#F6F5F2)", () => {
    expect(Colors.light.card).toBe("#F6F5F2");
    expect(Colors.light.cardElevated).toBe("#F6F5F2");
  });

  it("useTodayCardElevation drops shadow and border in light mode", () => {
    themeState.resolved = "light";
    const { result } = renderHook(() => useTodayCardElevation());
    expect(result.current.shadowStyle).toBeUndefined();
    expect(result.current.useBorder).toBe(false);
    expect(result.current.liftBg).toBeUndefined();
  });

  const TODAY_SUPPR_CARD_SURFACES = [
    "components/today/TodayHeroRing.tsx",
    "components/today/TodayDashboardMacroTiles.tsx",
    "components/today/TodayMealsSection.tsx",
    "components/today/TodayPlannedMealsCard.tsx",
    "components/today/TodayActivityBonusCard.tsx",
    "components/today/TodayActivityCard.tsx",
    "components/today/NorthStarBlock.tsx",
    "components/today/WeeklyCheckinBanner.tsx",
    "components/HydrationStimulantsCard.tsx",
  ];

  it.each(TODAY_SUPPR_CARD_SURFACES)(
    "%s uses lift=\"flat\" on SupprCard",
    (relPath) => {
      const src = readFileSync(join(ROOT, relPath), "utf8");
      expect(src).toMatch(/<SupprCard[\s\S]*?lift="flat"/);
    },
  );

  // The two below-hero cards Grace flagged as inconsistent (2026-06-08). They
  // are now flat `SupprCard` slabs like every other resting Today card — these
  // assertions fail if either reverts to a hand-rolled bordered `<View>` with
  // an inline tint (the exact drift that was fixed: WeeklyCheckinBanner's peach
  // `${Accent.primary}08` + clay border, WeeklyInsightCard's `rgba(237,234,…)`).
  it("WeeklyCheckinBanner is a flat SupprCard with no hand-rolled card border", () => {
    const src = readFileSync(
      join(ROOT, "components/today/WeeklyCheckinBanner.tsx"),
      "utf8",
    );
    expect(src).toMatch(/<SupprCard[\s\S]*?lift="flat"/);
    // No rogue card-surface border/tint on the outer wrapper. (The clay OPEN
    // button keeps its own `backgroundColor: Accent.primary` — that's a CTA,
    // not the card surface — so we only forbid the banner-tint pattern.)
    expect(src).not.toMatch(/backgroundColor:\s*`\$\{Accent\.primary\}08`/);
    expect(src).not.toMatch(/borderColor:\s*`\$\{Accent\.primary\}30`/);
  });

  it("WeeklyInsightCard renders both branches as SupprCards (no rogue inline rgba tint)", () => {
    const src = readFileSync(
      join(ROOT, "components/today/WeeklyInsightCard.tsx"),
      "utf8",
    );
    // Both the legacy stat-grid AND the Figma narrative branch are SupprCards.
    expect(src).not.toMatch(/rgba\(237,\s*234,\s*241/);
    // The deleted hand-rolled bordered card style must not come back.
    expect(src).not.toContain("figmaInsightCard");
  });

  it("index.tsx styles.card uses useTodayCardElevation (not soft lift)", () => {
    const src = readFileSync(join(ROOT, "app/(tabs)/index.tsx"), "utf8");
    expect(src).toContain("useTodayCardElevation");
    expect(src).not.toMatch(/useCardElevation\(\)/);
  });

  it("index.tsx styles.card uses CARD_RADIUS (24px)", () => {
    const src = readFileSync(join(ROOT, "app/(tabs)/index.tsx"), "utf8");
    expect(src).toMatch(/card:\s*\{[\s\S]*?borderRadius:\s*CARD_RADIUS/);
  });

  const TODAY_SUPPR_CARD_SHAPE_SURFACES = [
    "components/today/TodayFirstMealEmptyState.tsx",
    "components/today/TodayDashboardMacroBars.tsx",
    "components/today/WeeklyInsightCard.tsx",
  ];

  it.each(TODAY_SUPPR_CARD_SHAPE_SURFACES)(
    "%s uses SupprCard lift=\"flat\" for 24px corners",
    (relPath) => {
      const src = readFileSync(join(ROOT, relPath), "utf8");
      expect(src).toMatch(/<SupprCard[\s\S]*?lift="flat"/);
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
