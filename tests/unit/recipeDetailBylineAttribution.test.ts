/**
 * ENG-1084 — the recipe DETAIL byline must route through `displayAttribution`,
 * exactly like the Discover/Library card, so the legal seed string
 * "Suppr Kitchen" calms to "Sloe Kitchen" on the user-facing surface (and
 * internal-seed strings are dropped). The detail screens previously used the
 * raw `source_name` / `creatorName`, which surfaced "via Suppr Kitchen" on the
 * detail while the card correctly showed "Sloe Kitchen".
 *
 * Layer 1: behaviour — the helper the bylines now rely on does the calm-over.
 * Layer 2: callsite guard — both detail files import + call displayAttribution
 *          (catches a regression at write time even without a render test).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { displayAttribution } from "../../src/lib/recipes/displayAttribution";

const REPO = resolve(__dirname, "..", "..");
const read = (rel: string): string => readFileSync(resolve(REPO, rel), "utf8");
const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

const DETAIL_BYLINE_FILES = [
  "apps/mobile/app/recipe/[id].tsx",
  "src/app/components/RecipeDetail.tsx",
];

describe("ENG-1084 — recipe-detail byline calm-over", () => {
  it("displayAttribution remaps the legal seed brand on the byline", () => {
    expect(displayAttribution({ source: "Suppr Kitchen" })).toBe("Sloe Kitchen");
    expect(displayAttribution({ creatorName: "Suppr Kitchen" })).toBe("Sloe Kitchen");
    // real creators + handles pass through unchanged
    expect(displayAttribution({ creatorName: "Jamie Oliver" })).toBe("Jamie Oliver");
    expect(displayAttribution({ source: "@getherednutrition" })).toBe("@getherednutrition");
    // internal-seed leak is dropped (caller treats "" as no byline)
    expect(displayAttribution({ source: "system" })).toBe("");
  });

  it("both detail screens route their byline through displayAttribution", () => {
    for (const rel of DETAIL_BYLINE_FILES) {
      const code = stripComments(read(rel));
      expect(code, `${rel} must import displayAttribution`).toMatch(
        /import\s*\{[^}]*\bdisplayAttribution\b[^}]*\}\s*from\s*["'][^"']*displayAttribution/,
      );
      expect(code, `${rel} must call displayAttribution for the byline`).toMatch(
        /displayAttribution\(\s*\{/,
      );
    }
  });
});
