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

import { mapMealSourceToDot } from "@suppr/shared/nutrition/sourceMap";
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
    sourceUsda: "#56A775",
    sourceOff: "#588CE4",
    sourceFatsecret: "#F78A32",
    sourceManual: "#94a3b8",
    sourceAi: "#DF5EBC",
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
    // 2026-05-24 — inline 6pt success dot on meal rows (SourceDot
    // import retained for parity with LogSheet; row chrome uses the
    // compact dot so the header doesn't compete with MacroIconRow).
    expect(src).toMatch(/width:\s*6,\s*height:\s*6,\s*borderRadius:\s*3/);
  });

  it("LogSheet (mobile) imports SourceDot + TrustChip", () => {
    const filePath = path.resolve(
      __dirname,
      "../../components/today/LogSheet.tsx",
    );
    const src = fs.readFileSync(filePath, "utf8");
    expect(src).toMatch(/import\s*\{\s*SourceDot/);
    expect(src).toMatch(/import\s*\{\s*TrustChip\s*\}/);
  });
});
