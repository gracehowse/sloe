/**
 * @vitest-environment node
 *
 * Locks in the privacy-notice disclosure for caption-text imports. The
 * legal verdict (`docs/decisions/2026-04-30-ig-tt-recipe-import-legal-posture.md`)
 * gates the IG/TT/YouTube share-sheet feature on this disclosure being
 * live before any user can hit the new path. Asserts the literal text
 * (light-handed: phrase-level matches, not byte-for-byte) so that any
 * future edit either keeps the legally-required content or surfaces the
 * change in this test for the legal-reviewer agent to re-approve.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const PRIVACY_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "app",
  "privacy",
  "page.tsx",
);

const REQUIRED_PHRASES = [
  // Discloses what we read
  "caption text you sent us",
  // Discloses what we DO NOT do (key legal protection)
  "never fetch the original post or video",
  // Discloses what we store
  "creator", // creator handle
  // Provides the takedown channel
  "dmca@getsloe.com",
  // Provides the SLA
  "7 business days",
];

describe("Privacy policy — imported-recipes disclosure", () => {
  const source = readFileSync(PRIVACY_PATH, "utf8");
  // Collapse JSX whitespace (line breaks + indentation) so phrase matching
  // doesn't depend on the file's hard wrapping.
  const flat = source.replace(/\s+/g, " ");

  it("contains a heading for imported-recipes processing", () => {
    expect(flat).toMatch(/Imported recipes from public posts/i);
  });

  for (const phrase of REQUIRED_PHRASES) {
    it(`contains the required disclosure phrase: "${phrase}"`, () => {
      expect(flat).toContain(phrase);
    });
  }

  it("links to the /dmca page", () => {
    expect(source).toMatch(/href="\/dmca"/);
  });

  it("explicitly states Suppr does not fetch original posts/videos", () => {
    expect(flat).toMatch(
      /never fetch the original post or video from those platforms ourselves/i,
    );
  });
});

describe("Privacy policy — community food database withdrawal", () => {
  const source = readFileSync(PRIVACY_PATH, "utf8");
  const flat = source.replace(/\s+/g, " ");

  it("adds a dedicated community food database section", () => {
    expect(flat).toContain("Community food database");
    expect(source).toContain('id="community-food-database"');
  });

  it("states what barcode contribution data is visible and how to remove it", () => {
    expect(flat).toContain("product name, barcode, brand, nutrition values");
    expect(flat).toContain("they do not see your email or profile details");
    expect(flat).toContain("Settings &rarr; Privacy");
    expect(flat).toContain("Barcode contributions");
  });
});
