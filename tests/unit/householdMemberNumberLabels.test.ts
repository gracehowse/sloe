/**
 * G-5 (TestFlight `AJKHqJeCi83sCHF3_7CZMhY`, 2026-04-19) — tester
 * couldn't tell what the four numbers next to their name were
 * (target? consumed? remaining?). This test pins the new copy across
 * both platforms: unambiguous column headers ("Cal left" / "Protein
 * left" / "Carbs left" / "Fat left") and a one-line caption directly
 * under MEMBERS.
 *
 * Structural source-level pins live here (rather than a render test)
 * because the copy is the contract — the row geometry is already
 * covered by existing household parity tests.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const WEB_PATH = resolve(__dirname, "../../src/app/components/HouseholdPanel.tsx");
const MOBILE_PATH = resolve(
  __dirname,
  "../../apps/mobile/components/HouseholdCard.tsx",
);

const WEB_SRC = readFileSync(WEB_PATH, "utf8");
const MOBILE_SRC = readFileSync(MOBILE_PATH, "utf8");

const REQUIRED_COLUMN_LABELS = [
  "Cal left",
  "Protein left",
  "Carbs left",
  "Fat left",
];

// One explanatory line that sits under MEMBERS on both surfaces.
const CAPTION_COPY = "Remaining today — your totals left to hit your targets.";

describe("household member-number labels (G-5)", () => {
  for (const label of REQUIRED_COLUMN_LABELS) {
    it(`web renders the '${label}' column label`, () => {
      expect(WEB_SRC).toContain(label);
    });
    it(`mobile renders the '${label}' column label`, () => {
      expect(MOBILE_SRC).toContain(label);
    });
  }

  it("web renders the explanatory caption under MEMBERS", () => {
    expect(WEB_SRC).toContain(CAPTION_COPY);
  });

  it("mobile renders the explanatory caption under MEMBERS", () => {
    expect(MOBILE_SRC).toContain(CAPTION_COPY);
  });

  it("old single-letter header labels are gone on web", () => {
    // The old grid rendered `<p>Cal</p>`, `<p>P</p>`, `<p>C</p>`,
    // `<p>F</p>` as 10px grey captions. We replace those with the full
    // "Cal left" / etc. labels. Match conservatively so we don't trip
    // on the word "Cal" appearing inside "Cal left".
    expect(WEB_SRC).not.toMatch(/>P<\/p>\s*<p/);
    expect(WEB_SRC).not.toMatch(/>C<\/p>\s*<p/);
    expect(WEB_SRC).not.toMatch(/>F<\/p>\s*<p/);
  });

  it("old single-letter header labels are gone on mobile", () => {
    // The old mobile render used `["P", ..., t.protein]` style tuples.
    // Ensure no stray one-letter 'P' / 'C' / 'F' remain in the member
    // number rendering block (we still use words like 'Protein' and
    // 'Carbs' which are fine).
    expect(MOBILE_SRC).not.toMatch(/\["P",\s*m\.remaining\.protein/);
    expect(MOBILE_SRC).not.toMatch(/\["C",\s*m\.remaining\.carbs/);
    expect(MOBILE_SRC).not.toMatch(/\["F",\s*m\.remaining\.fat/);
  });
});
