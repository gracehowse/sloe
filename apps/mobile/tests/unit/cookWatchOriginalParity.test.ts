/**
 * Recime parity quick-win — "Watch original" affordance on the Cook
 * surfaces (2026-04-30).
 *
 * Pins that the mobile cook surfaces (the dedicated `cook.tsx` route
 * and the inline cook overlay in `recipe/[id].tsx`):
 *
 *   1. Import the shared `extractVideoHost` host classifier from
 *      `src/lib/recipes/heroImageFallback.ts`.
 *   2. Conditionally render a "Watch original" pill (`testID =
 *      cook-watch-original`) only when a source video URL is present.
 *   3. Open the URL with `Linking.openURL` on tap (system handler /
 *      native app deep link — same path the recipe-byline link uses).
 *   4. Fire `cook_watch_original_tapped` with the host classification.
 *
 * Source-level tests because the mobile cook surfaces use Expo Router
 * + react-native primitives that vitest/jsdom can't render. RNTL is on
 * the R7 backlog — when it lands, replace these with real interaction
 * tests. Mirrors the precedent set by `cookAnalyticsParity.test.ts`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const COOK_PATH = resolve(__dirname, "../../app/cook.tsx");
const RECIPE_PATH = resolve(__dirname, "../../app/recipe/[id].tsx");

const COOK_SOURCE = readFileSync(COOK_PATH, "utf8");
const RECIPE_SOURCE = readFileSync(RECIPE_PATH, "utf8");

describe("mobile cook.tsx — Watch original pill", () => {
  it("imports extractVideoHost from the shared heroImageFallback helper", () => {
    expect(COOK_SOURCE).toMatch(
      /import\s*\{\s*extractVideoHost\s*\}\s*from\s+["'][^"']*\/recipes\/heroImageFallback["']/,
    );
  });

  it("imports Play from lucide-react-native (prototype glyph parity)", () => {
    expect(COOK_SOURCE).toMatch(
      /import\s*\{[^}]*\bPlay\b[^}]*\}\s*from\s+["']lucide-react-native["']/,
    );
  });

  it("imports Linking from react-native (system handler / deep link)", () => {
    expect(COOK_SOURCE).toMatch(
      /import\s*\{[^}]*\bLinking\b[^}]*\}\s*from\s+["']react-native["']/,
    );
  });

  it("reads sourceVideoUrl + sourceUrl from query params", () => {
    expect(COOK_SOURCE).toMatch(/sourceVideoUrl/);
    expect(COOK_SOURCE).toMatch(/sourceUrl/);
  });

  it("renders the pill conditionally on a watchOriginalUrl truthy guard", () => {
    expect(COOK_SOURCE).toMatch(/watchOriginalUrl\s*\?/);
  });

  it("renders the pill with the testID cook-watch-original", () => {
    expect(COOK_SOURCE).toMatch(/testID=["']cook-watch-original["']/);
  });

  it("uses Linking.openURL to open the link", () => {
    expect(COOK_SOURCE).toMatch(/Linking\.openURL\s*\(/);
  });

  it("fires cook_watch_original_tapped with host classification", () => {
    expect(COOK_SOURCE).toMatch(
      /track\(\s*AnalyticsEvents\.cook_watch_original_tapped\b/,
    );
    expect(COOK_SOURCE).toMatch(/videoHost\s*:/);
  });
});

describe("mobile recipe/[id].tsx — routes watch-original to canonical /cook (ENG-945)", () => {
  it("threads sourceUrl into buildCookModeHref for the rich cook screen", () => {
    expect(RECIPE_SOURCE).toMatch(/buildCookModeHref\(/);
    expect(RECIPE_SOURCE).toMatch(/sourceUrl:\s*recipe\.source_url/);
  });

  it("no longer renders an inline cook overlay watch-original pill", () => {
    expect(RECIPE_SOURCE).not.toMatch(/testID=["']cook-watch-original["']/);
    expect(RECIPE_SOURCE).not.toMatch(/watchOriginalUrl\s*=\s*recipe\??\.source_url/);
  });
});

describe("mobile recipe/[id].tsx — hero image fallback ladder", () => {
  it("uses pickHeroImageUrl with image_url + source_url candidates", () => {
    expect(RECIPE_SOURCE).toMatch(/pickHeroImageUrl\(\s*\{[^}]*image_url\s*:\s*recipe\??\.image_url[^}]*\}/);
    expect(RECIPE_SOURCE).toMatch(/pickHeroImageUrl\(\s*\{[^}]*source_url\s*:\s*recipe\??\.source_url[^}]*\}/);
  });
});
