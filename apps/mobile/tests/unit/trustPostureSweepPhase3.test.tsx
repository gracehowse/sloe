/**
 * trustPostureSweepPhase3 — mobile mirror of
 * tests/unit/trustPostureSweepPhase3.test.tsx.
 *
 * Authority: D-2026-04-27-16.
 *
 * Pins that the mobile macro-bearing rendering sites import the
 * canonical SourceDot + mapMealSourceToDot, and that the primitive
 * itself renders cleanly across all 5 source variants.
 */

import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react-native";
import * as fs from "node:fs";
import * as path from "node:path";

import { mapMealSourceToDot } from "@suppr/nutrition-core/sourceMap";
import { SourceDot } from "../../components/ui/SourceDot";
import { TrustChip } from "../../components/ui/TrustChip";

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#000",
    textSecondary: "#555",
    textTertiary: "#888",
    background: "#fff",
    card: "#fff",
    cardBorder: "#eee",
    border: "#eee",
    inputBg: "#f4f4f4",
    sourceUsda: "#5E7C5A",
    sourceOff: "#4A7878",
    sourceFatsecret: "#C9892C",
    sourceManual: "#94a3b8",
    sourceAi: "#6A4B7A",
  }),
}));

describe("mapMealSourceToDot (mobile)", () => {
  it("USDA → usda", () => expect(mapMealSourceToDot("USDA")).toBe("usda"));
  it("OFF → off", () => expect(mapMealSourceToDot("OFF")).toBe("off"));
  it("FatSecret → fatsecret", () => expect(mapMealSourceToDot("FatSecret")).toBe("fatsecret"));
  it("AI photo → ai", () => expect(mapMealSourceToDot("AI photo")).toBe("ai"));
  it("Custom → manual", () => expect(mapMealSourceToDot("Custom")).toBe("manual"));
  it("null → manual", () => expect(mapMealSourceToDot(null)).toBe("manual"));
});

describe("SourceDot (mobile) — every variant renders", () => {
  it.each(["usda", "off", "fatsecret", "manual", "ai"] as const)(
    "renders %s without throwing",
    (source) => {
      const { toJSON } = render(<SourceDot source={source} />);
      expect(toJSON()).not.toBeNull();
    },
  );
});

describe("TrustChip (mobile) — every variant renders the spec copy", () => {
  it.each([
    ["usda", "USDA verified"],
    ["off-adjusted", "OFF · adjusted"],
    ["estimated", "Estimated · verify"],
    ["manual", "Manual"],
    ["gluten-high-conf", "No gluten-containing ingredients"],
    ["gluten-uncertain", "Contains potential gluten · review"],
  ] as const)("variant %s shows '%s'", (variant, expected) => {
    const { getByText } = render(<TrustChip variant={variant} />);
    expect(getByText(expected)).toBeTruthy();
  });
});

describe("Phase 3 trust posture sweep — mobile source pins", () => {
  it("TodayMealsSection keeps meal-row source attribution wiring", () => {
    const filePath = path.resolve(
      __dirname,
      "../../components/today/TodayMealsSection.tsx",
    );
    const src = fs.readFileSync(filePath, "utf8");
    expect(src).toMatch(/import\s*\{\s*SourceDot/);
    expect(src).toMatch(/mapMealSourceToDot/);
    // ENG-1418 (2026-07-05 deep audit, finding tl-F2/label-F2) — the
    // 2026-05-24 decision kept SourceDot's import "for parity" but
    // rendered a hardcoded Accent.success dot instead, so EVERY
    // non-thumbnail meal row showed a green "verified" dot regardless
    // of actual source (AI-estimated and manual entries included).
    // Fixed to actually call SourceDot with the mapped source, matching
    // the RecipeIngredientGrid / web today-meals-section pattern.
    expect(src).toMatch(/<SourceDot\s+source=\{mapMealSourceToDot\([^)]*\)\}\s+size=\{6\}\s*\/>/);
    expect(src).not.toMatch(/backgroundColor:\s*Accent\.success/);
  });

  it("LogSheet (mobile) imports TrustChip; the extracted confirmation imports SourceDot", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../../components/today/LogSheet.tsx"),
      "utf8",
    );
    expect(src).toMatch(/import\s*\{\s*TrustChip\s*\}/);
    // ENG-1484 — the S13 LoggedConfirmation (the SourceDot consumer) was
    // extracted to its own file per the screen-budget ratchet; the provenance
    // dot pin follows it.
    const confirmation = fs.readFileSync(
      path.resolve(__dirname, "../../components/today/LogSheetConfirmation.tsx"),
      "utf8",
    );
    expect(confirmation).toMatch(/import\s*\{\s*SourceDot\s*\}/);
  });
});
