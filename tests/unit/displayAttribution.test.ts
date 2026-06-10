/**
 * displayAttribution — the user-facing recipe-card byline boundary.
 *
 * Two jobs, both applied at render (never in the seed data):
 *   1. Drop internal seed-source strings ("system", "onboarding", …) so
 *      developer-facing attribution never leaks onto a Discover/Library
 *      card (2026-04-30 visual-qa).
 *   2. Calm the stale brand on the curated seed byline: the seed records
 *      its LEGAL author as "Suppr Kitchen" (the copyright/IP provenance
 *      pinned by `discoverSeedCopyright.test.ts`), but the live brand is
 *      Sloe — so the rendered byline must read "Sloe Kitchen"
 *      (2026-06-08 rebrand display remap).
 *
 * The legal `attribution.author` field is intentionally NOT renamed in
 * the seed data — that contract is asserted by discoverSeedCopyright.
 * This test pins the display-boundary remap so the two can never drift:
 * data stays "Suppr Kitchen", the screen calms to "Sloe Kitchen".
 */
import { describe, expect, it } from "vitest";
import { displayAttribution } from "../../src/lib/recipes/displayAttribution";

describe("displayAttribution — brand display remap (2026-06-08)", () => {
  it("renders the curated seed byline as 'Sloe Kitchen', not the legal 'Suppr Kitchen'", () => {
    expect(displayAttribution({ creatorName: "Suppr Kitchen" })).toBe("Sloe Kitchen");
  });

  it("is case-insensitive on the match but emits the canonical 'Sloe Kitchen' casing", () => {
    expect(displayAttribution({ creatorName: "suppr kitchen" })).toBe("Sloe Kitchen");
    expect(displayAttribution({ creatorName: "SUPPR KITCHEN" })).toBe("Sloe Kitchen");
    expect(displayAttribution({ creatorName: "  Suppr Kitchen  " })).toBe("Sloe Kitchen");
  });

  it("remaps when the brand arrives via `source` rather than `creatorName`", () => {
    expect(displayAttribution({ source: "Suppr Kitchen" })).toBe("Sloe Kitchen");
  });

  it("never emits the stale brand for the seed byline", () => {
    expect(displayAttribution({ creatorName: "Suppr Kitchen" })).not.toContain("Suppr");
  });
});

describe("displayAttribution — passthrough + internal-seed filtering (unchanged)", () => {
  it("passes a real creator name straight through", () => {
    expect(displayAttribution({ creatorName: "Maria Konnikova" })).toBe("Maria Konnikova");
  });

  it("does not touch other brand-adjacent names (remap is exact, not a fuzzy replace)", () => {
    // Only the exact "Suppr Kitchen" string calms — a creator who happens
    // to have "Suppr" in their handle is left alone.
    expect(displayAttribution({ creatorName: "Suppr Fan Club" })).toBe("Suppr Fan Club");
  });

  it("still drops developer-facing internal seed sources", () => {
    expect(displayAttribution({ creatorName: "system" })).toBe("");
    expect(displayAttribution({ source: "Suppr onboarding" })).toBe("");
    expect(displayAttribution({ creatorName: "internal" })).toBe("");
  });

  it("returns empty string when there is nothing display-worthy", () => {
    expect(displayAttribution({})).toBe("");
    expect(displayAttribution({ creatorName: "", source: "" })).toBe("");
    expect(displayAttribution({ creatorName: null, source: null })).toBe("");
  });

  it("prefers creatorName over source when both are present", () => {
    expect(
      displayAttribution({ creatorName: "Maria Konnikova", source: "Suppr Kitchen" }),
    ).toBe("Maria Konnikova");
  });
});
