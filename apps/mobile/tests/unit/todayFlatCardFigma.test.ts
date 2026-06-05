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
    "components/today/NorthStarBlock.tsx",
    "components/HydrationStimulantsCard.tsx",
  ];

  it.each(TODAY_SUPPR_CARD_SURFACES)(
    "%s uses lift=\"flat\" on SupprCard",
    (relPath) => {
      const src = readFileSync(join(ROOT, relPath), "utf8");
      expect(src).toMatch(/<SupprCard[\s\S]*?lift="flat"/);
    },
  );

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

  it("soft lift remains the default for non-Today hooks", () => {
    const hookSrc = readFileSync(
      join(ROOT, "hooks/useCardElevation.ts"),
      "utf8",
    );
    expect(hookSrc).toContain('variant ?? "soft"');
    expect(Elevation.cardSoft.shadowOpacity).toBeGreaterThan(0);
  });
});
