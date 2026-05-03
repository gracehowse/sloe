/**
 * discoverSeedCopyright — pin the legal / IP attribution contract for
 * the curated Discover seed.
 *
 * Per `docs/decisions/2026-04-27-onboarding-seed-copyright-review.md`,
 * the only shippable in-app recipe content is path-1 (originally
 * authored by Suppr) or path-2 (AI-generated, human-edited Suppr
 * authorship). Both carry `source_name = "Suppr"` / `source_url = NULL`
 * in the recipes table mirror. **Every seed entry MUST declare which.**
 *
 * Why this is critical: an unattributed recipe could leak a
 * URL-imported or image/OCR-imported row into the curated catalogue,
 * which the legal review forbids ("DO NOT use for onboarding seeds").
 * Hero images carry the Unsplash provider declaration so any future
 * image-rights audit has a per-row pointer.
 *
 * If this test starts failing, do NOT loosen it. Either:
 *   1. add the missing `attribution` block to the offending recipe, or
 *   2. remove the recipe.
 *
 * Companion: `discoverSeedShape.test.ts` pins the structural shape.
 */
import { describe, expect, it } from "vitest";
import { SEED_RECIPES_V2 } from "../../src/lib/recipes/seedRecipesV2";

describe("discoverSeedCopyright", () => {
  it("every recipe declares an attribution block", () => {
    for (const r of SEED_RECIPES_V2) {
      expect(r.attribution, `attribution missing on ${r.id}`).toBeDefined();
    }
  });

  it("every recipe attributes prose to Suppr Kitchen (path-1 or path-2 per legal review)", () => {
    // The legal review allows only Suppr-authored or AI-generated-and-
    // edited-by-Suppr content. Any other author string is a sign
    // someone shipped a republished third-party recipe, which is
    // explicitly forbidden.
    for (const r of SEED_RECIPES_V2) {
      expect(r.attribution.author, `author for ${r.id}`).toBe("Suppr Kitchen");
    }
  });

  it("every recipe declares a known origin (`original` or `ai-generated-edited`)", () => {
    const ALLOWED = new Set(["original", "ai-generated-edited"]);
    for (const r of SEED_RECIPES_V2) {
      expect(
        ALLOWED.has(r.attribution.origin),
        `origin "${r.attribution.origin}" for ${r.id} must be one of [original, ai-generated-edited]`,
      ).toBe(true);
    }
  });

  it("every recipe records its hero image source", () => {
    for (const r of SEED_RECIPES_V2) {
      expect(r.attribution.imageSource, `imageSource missing on ${r.id}`).toBeDefined();
      expect(r.attribution.imageSource.provider, `image provider for ${r.id}`).toBe("unsplash");
      expect(r.attribution.imageSource.url, `image url for ${r.id}`).toMatch(
        /^https:\/\/images\.unsplash\.com\//,
      );
    }
  });

  it("the recorded image URL matches the heroImageUrl the card actually renders", () => {
    // Catches drift where someone edits the visible hero but forgets
    // the legal attribution pointer (or vice versa) — both must point
    // at the same asset.
    for (const r of SEED_RECIPES_V2) {
      expect(
        r.attribution.imageSource.url,
        `imageSource.url drifted from heroImageUrl on ${r.id}`,
      ).toBe(r.heroImageUrl);
    }
  });

  it("attribution notes, when present, are non-empty descriptive strings (never URLs)", () => {
    // `notes` is a display-only regional cuisine pointer (e.g.
    // "Mexican", "Levantine"). It must never carry a URL — that
    // would imply we're republishing from a specific source, which
    // contradicts the path-1/path-2 posture.
    for (const r of SEED_RECIPES_V2) {
      const notes = r.attribution.notes;
      if (notes == null) continue;
      expect(notes.length, `notes for ${r.id}`).toBeGreaterThan(0);
      expect(notes, `notes for ${r.id} must not embed a URL`).not.toMatch(/https?:\/\//);
    }
  });

  it("no recipe carries a sourceUrl pointing at a third-party publisher (path-1/path-2 contract)", () => {
    // The seed type doesn't include a sourceUrl field; this test
    // hardens that by checking no recipe smuggles one in via a
    // looser cast. If TypeScript lets `(r as any).sourceUrl` exist,
    // we still want a runtime guard.
    for (const r of SEED_RECIPES_V2) {
      expect(
        (r as { sourceUrl?: unknown }).sourceUrl,
        `sourceUrl unexpectedly present on ${r.id}`,
      ).toBeUndefined();
    }
  });
});
