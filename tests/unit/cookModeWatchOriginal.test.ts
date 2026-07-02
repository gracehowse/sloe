/**
 * Recime parity quick-win — Web Cook + RecipeDetail surfaces
 * (2026-04-30).
 *
 * Pins:
 *   1. `src/app/components/CookMode.tsx` renders a "Watch original"
 *      button that:
 *        - is gated on `recipe.sourceUrl` truthiness
 *        - opens the URL via `window.open(... '_blank'
 *          'noopener,noreferrer')` (no `window.opener` reach-back)
 *        - fires `cook_watch_original_tapped` with the
 *          `extractVideoHost` classification.
 *   2. `src/app/components/RecipeDetail.tsx` uses `pickHeroImageUrl`
 *      to compute the hero `<img src>` so a YT-source recipe with
 *      no `image_url` gets a YT thumbnail instead of the stock
 *      Unsplash placeholder.
 *
 * Source-level tests — vitest/jsdom can render the components but the
 * test surface here is the wiring + event payload, which a structural
 * scan covers cheaply and durably. A render test would pass if the
 * pill exists but never fired the event; this scan catches that drift.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const COOK_PATH = resolve(__dirname, "../../src/app/components/CookMode.tsx");
const DETAIL_PATH = resolve(__dirname, "../../src/app/components/RecipeDetail.tsx");

const COOK_SOURCE = readFileSync(COOK_PATH, "utf8");
const DETAIL_SOURCE = readFileSync(DETAIL_PATH, "utf8");

describe("web CookMode.tsx — Watch original button", () => {
  it("imports extractVideoHost from the shared heroImageFallback helper", () => {
    expect(COOK_SOURCE).toMatch(
      /import\s*\{[^}]*\bextractVideoHost\b[^}]*\}\s*from\s+["'][^"']*\/recipes\/heroImageFallback(?:\.ts)?["']/,
    );
  });

  it("imports Play from lucide-react (icon parity with mobile)", () => {
    expect(COOK_SOURCE).toMatch(
      /import\s*\{[^}]*\bPlay\b[^}]*\}\s*from\s+["']lucide-react["']/,
    );
  });

  it("derives watchOriginalUrl from recipe.sourceUrl", () => {
    expect(COOK_SOURCE).toMatch(/watchOriginalUrl/);
    expect(COOK_SOURCE).toMatch(/recipe\.sourceUrl/);
  });

  it("opens the URL with window.open and noopener,noreferrer", () => {
    expect(COOK_SOURCE).toMatch(/window\.open\(\s*watchOriginalUrl[^)]*noopener[^)]*noreferrer/);
  });

  it("fires cook_watch_original_tapped with videoHost classification", () => {
    expect(COOK_SOURCE).toMatch(
      /track\(\s*AnalyticsEvents\.cook_watch_original_tapped\b/,
    );
    expect(COOK_SOURCE).toMatch(/videoHost\s*:/);
  });

  it("gates the button on watchOriginalUrl presence", () => {
    expect(COOK_SOURCE).toMatch(/watchOriginalUrl\s*\?/);
  });

  it("uses the cook-watch-original test id (parity with mobile)", () => {
    expect(COOK_SOURCE).toMatch(/data-testid=["']cook-watch-original["']/);
  });
});

describe("web RecipeDetail.tsx — hero image fallback ladder", () => {
  it("imports pickHeroImageUrl from the shared helper", () => {
    expect(DETAIL_SOURCE).toMatch(
      /import\s*\{[^}]*\bpickHeroImageUrl\b[^}]*\}\s*from\s+["'][^"']*\/recipes\/heroImageFallback(?:\.ts)?["']/,
    );
  });

  it("carries no stock-placeholder default (honest imagery, ENG-1287)", () => {
    // The AppDataContext mapper no longer substitutes a stock Unsplash
    // photo for image-less recipes (image stays null), so the detail
    // must not reference the retired constant. Legacy DB rows that
    // persisted the retired URL are nulled via isRetiredStockImageUrl.
    expect(DETAIL_SOURCE).not.toMatch(/DEFAULT_UPLOADED_RECIPE_IMAGE/);
    expect(DETAIL_SOURCE).toMatch(/isRetiredStockImageUrl/);
  });

  it("calls pickHeroImageUrl with image_url + source_url candidates", () => {
    expect(DETAIL_SOURCE).toMatch(/pickHeroImageUrl\(/);
    expect(DETAIL_SOURCE).toMatch(/source_url\s*:\s*recipe\.sourceUrl/);
  });
});
