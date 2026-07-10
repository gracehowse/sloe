/**
 * trustPostureSweepPhase3 — pins the Phase 3 (B2.4, 2026-04-27)
 * trust-posture sweep across the macro-bearing rendering sites.
 *
 * Authority: D-2026-04-27-16 (consistent trust posture on every
 * macro-bearing row, app-wide).
 *
 * Spec sweep (production design spec §1.6):
 *   - Diary / meal row → SourceDot 6px + source label inline.
 *   - Recipe card → TrustChip variant.
 *   - Recipe detail hero → TrustChip immediately under title.
 *   - Recipe ingredient row → SourceDot + source label, "Verify →"
 *     when estimated.
 *   - Voice / photo review row → TrustChip `estimated`.
 *   - Search results in LogSheet → SourceDot + source label.
 *   - Adaptive TDEE display → ConfidenceChip inline.
 *
 * Phase 3 ships:
 *   - SourceDot wired into the today meal row (web + mobile) via
 *     `mapMealSourceToDot` — closes the "diary / meal row" target.
 *   - LogSheet primitive renders SourceDot on every search / recent /
 *     saved row by construction (covered by logSheetPhase3.test.tsx).
 *   - TrustChip primitive available for every detail surface to opt
 *     into (Recipe detail, Voice/Photo review, etc.) — staged sweep.
 *
 * What's pinned here:
 *   - mapMealSourceToDot returns a valid SourceDot key for every
 *     known journal source label.
 *   - The today-meals-section (web) imports SourceDot + the mapper
 *     and renders the dot.
 */

import * as React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import * as fs from "node:fs";
import * as path from "node:path";

import { mapMealSourceToDot } from "../../src/lib/nutrition/sourceMap";
import { SourceDot } from "../../src/app/components/ui/source-dot";
import { TrustChip } from "../../src/app/components/ui/trust-chip";

describe("mapMealSourceToDot — canonical source mapper", () => {
  const cases: Array<[string | null | undefined, string]> = [
    [null, "manual"],
    [undefined, "manual"],
    ["", "manual"],
    ["USDA", "usda"],
    ["usda foundation", "usda"],
    ["OFF", "off"],
    ["Open Food Facts", "off"],
    ["openfoodfacts", "off"],
    ["FatSecret Premier", "fatsecret"],
    ["FatSecret", "fatsecret"],
    ["Custom", "manual"],
    ["Manual entry", "manual"],
    ["AI photo", "ai"],
    ["AI voice", "ai"],
    ["Estimated", "ai"],
    ["barcode", "off"],
    ["Recipe", "manual"],
    ["unknown source", "manual"],
  ];

  cases.forEach(([input, expected]) => {
    it(`maps ${JSON.stringify(input)} → ${expected}`, () => {
      expect(mapMealSourceToDot(input as string | null | undefined)).toBe(expected);
    });
  });
});

describe("SourceDot rendering — every variant", () => {
  it("renders 5 variants without throwing", () => {
    const sources: Array<"usda" | "off" | "fatsecret" | "manual" | "ai"> = [
      "usda",
      "off",
      "fatsecret",
      "manual",
      "ai",
    ];
    for (const s of sources) {
      const { container } = render(<SourceDot source={s} />);
      expect(container.querySelector('[data-slot="source-dot"]')).toBeTruthy();
    }
  });
});

describe("TrustChip rendering — every variant", () => {
  it("renders 6 variants with the spec copy", () => {
    const variants: Array<{ v: Parameters<typeof TrustChip>[0]["variant"]; expected: string }> = [
      { v: "usda", expected: "USDA verified" },
      { v: "off-adjusted", expected: "OFF · adjusted" },
      { v: "estimated", expected: "Estimated · verify" },
      { v: "manual", expected: "Manual" },
      { v: "gluten-high-conf", expected: "No gluten-containing ingredients" },
      { v: "gluten-uncertain", expected: "Contains potential gluten · review" },
    ];
    for (const { v, expected } of variants) {
      const { unmount } = render(<TrustChip variant={v} />);
      expect(screen.getByText(expected)).toBeDefined();
      unmount();
    }
  });
});

describe("Phase 3 trust posture sweep — source pins", () => {
  it("today-meals-section (web) imports SourceDot + mapMealSourceToDot", () => {
    const filePath = path.resolve(
      __dirname,
      "../../src/app/components/suppr/today-meals-section.tsx",
    );
    const src = fs.readFileSync(filePath, "utf8");
    expect(src).toMatch(/import\s*\{\s*SourceDot\s*\}\s*from/);
    expect(src).toMatch(/mapMealSourceToDot/);
    // The dot is rendered with size=6 per spec §1.6 ("6px on rows").
    expect(src).toMatch(/<SourceDot[\s\S]+?size=\{6\}/);
  });

  it("LogSheet (web) imports TrustChip; the extracted confirmation imports SourceDot", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../../src/app/components/suppr/log-sheet.tsx"),
      "utf8",
    );
    expect(src).toMatch(/import\s*\{\s*TrustChip\s*\}/);
    // ENG-1484 — the S13 LoggedConfirmation (the SourceDot consumer) was
    // extracted to its own file per the screen-budget ratchet; the provenance
    // dot pin follows it.
    const confirmation = fs.readFileSync(
      path.resolve(__dirname, "../../src/app/components/suppr/log-sheet-confirmation.tsx"),
      "utf8",
    );
    expect(confirmation).toMatch(/import\s*\{\s*SourceDot\s*\}/);
  });
});
