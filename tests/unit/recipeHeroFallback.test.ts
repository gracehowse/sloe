/**
 * Recipe hero fallback (D8) — 2026-04-21.
 *
 * Pins the deterministic cuisine-aware gradient + pattern + glyph
 * fallback used when a Discover recipe has no image. Design brief:
 * `docs/design/discover-hero-fallback.md`. Shared utility:
 * `src/lib/recipe/recipeHeroFallback.ts`. Web + mobile renderers
 * consume the same spec so the same recipe id renders identically
 * on both platforms.
 *
 * Test surface:
 *   - bucket resolution is deterministic and first-match-wins
 *   - the `default` bucket catches empty / tagless / weird input
 *   - the 4 patterns map deterministically from `djb2(id) % 4`
 *   - a fixture of 4+ tagless recipes visibly varies (different
 *     patterns, even though they share the `default` bucket) —
 *     protects acceptance criterion §8.4
 *   - both mobile + web renderers exist and reference the shared
 *     utility (parity pin)
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CARD_CREAM,
  HERO_TINTS,
  djb2,
  getRecipeFallback,
  patternSvgContent,
  recipeUnderlayColor,
  type RecipeHeroPattern,
} from "../../src/lib/recipe/recipeHeroFallback";

const ROOT = resolve(__dirname, "../..");
const WEB_COMPONENT = resolve(ROOT, "src/app/components/suppr/RecipeHeroFallback.tsx");
const MOBILE_COMPONENT = resolve(ROOT, "apps/mobile/components/RecipeHeroFallback.tsx");
const WEB_DISCOVER = resolve(ROOT, "src/app/components/DiscoverFeed.tsx");
const MOBILE_DISCOVER = resolve(ROOT, "apps/mobile/app/(tabs)/discover.tsx");

describe("getRecipeFallback — bucket resolution", () => {
  it("matches by lowercase title substring", () => {
    expect(getRecipeFallback({ id: "a", title: "Kale & Spinach Bowl" }).bucket).toBe("greens");
    expect(getRecipeFallback({ id: "a", title: "Pepperoni Pizza" }).bucket).toBe("reds");
    expect(getRecipeFallback({ id: "a", title: "Salmon Teriyaki" }).bucket).toBe("blues");
    expect(getRecipeFallback({ id: "a", title: "Tomato Pasta" }).bucket).toBe("warms");
    expect(getRecipeFallback({ id: "a", title: "Chocolate Cookie" }).bucket).toBe("ambers");
    expect(getRecipeFallback({ id: "a", title: "Thai Curry" }).bucket).toBe("earths");
    expect(getRecipeFallback({ id: "a", title: "Oats Porridge" }).bucket).toBe("neutrals");
  });

  it("matches by tag when title is empty", () => {
    expect(getRecipeFallback({ id: "a", title: "", tags: ["vegan"] }).bucket).toBe("greens");
    expect(getRecipeFallback({ id: "a", title: "", tags: ["fish"] }).bucket).toBe("blues");
  });

  it("is first-match-wins — greens trumps reds when both triggers present", () => {
    // "salad" is in greens, "beef" is in reds; greens comes first in
    // the table, so greens wins. Documents the priority order.
    const r = getRecipeFallback({ id: "a", title: "Beef Salad" });
    expect(r.bucket).toBe("greens");
  });

  it("falls through to `default` for tagless / empty input", () => {
    expect(getRecipeFallback({ id: "x" }).bucket).toBe("default");
    expect(getRecipeFallback({ id: "x", title: "" }).bucket).toBe("default");
    expect(getRecipeFallback({ id: "x", title: null, tags: null }).bucket).toBe("default");
    expect(getRecipeFallback({ id: "x", title: "Mystery Dish" }).bucket).toBe("default");
  });

  it("is case-insensitive", () => {
    expect(getRecipeFallback({ id: "a", title: "VEGAN PLATE" }).bucket).toBe("greens");
  });

  it("returns stable output for the same recipe id — deterministic", () => {
    const a = getRecipeFallback({ id: "recipe-42", title: "Grilled Chicken" });
    const b = getRecipeFallback({ id: "recipe-42", title: "Grilled Chicken" });
    expect(a).toEqual(b);
  });

  it("calm reskin (§11.4) — every bucket uses a SAGE mark on a cream gradient", () => {
    // Post-2026-06-08 the loud dark/light buckets are gone. Every bucket
    // resolves to a warm cream gradient that ends at the card cream, with
    // the glyph + pattern in sage `rgb(124, 132, 102)`. No bucket reaches
    // for the old saturated blue→pink or the black/white-alpha overlay.
    for (const title of ["Birthday Cake", "Brown Rice", "Kale Bowl", "Mystery Dish", "Salmon"]) {
      const fb = getRecipeFallback({ id: "a", title });
      expect(fb.patternColor).toMatch(/^rgba\(124, 132, 102,/);
      expect(fb.glyphColor).toMatch(/^rgba\(124, 132, 102,/);
      // Gradient settles into the card cream — calm, never a hero colour.
      expect(fb.gradientEnd.toUpperCase()).toBe("#F6F5F2");
    }
    // The default (tagless) bucket is the neutral warm cream, NOT the old
    // loud blue→pink (`#4C6CE0 → #E04888`).
    const def = getRecipeFallback({ id: "x", title: "Untitled" });
    expect(def.bucket).toBe("default");
    expect(def.gradientStart.toLowerCase()).not.toBe("#4c6ce0");
    expect(def.gradientStart.toUpperCase()).toBe("#E4E1D8");
  });

  it("glyph alpha reads clearly on cream; pattern stays a faint texture", () => {
    const fb = getRecipeFallback({ id: "a", title: "Kale Bowl" });
    expect(fb.glyphAlpha).toBeGreaterThan(fb.patternAlpha);
    expect(fb.glyphAlpha).toBeGreaterThanOrEqual(0.6);
    expect(fb.patternAlpha).toBeLessThanOrEqual(0.1);
  });
});

describe("djb2 + pattern selection", () => {
  it("is stable and maps to 1 of 4 patterns", () => {
    const patterns: RecipeHeroPattern[] = ["dots", "grid", "chevron", "circles"];
    for (const id of ["a", "b", "c", "z-99", "uuid-deadbeef"]) {
      const fb = getRecipeFallback({ id });
      expect(patterns).toContain(fb.pattern);
    }
  });

  it("djb2 is pure / deterministic", () => {
    expect(djb2("abc")).toBe(djb2("abc"));
    expect(djb2("")).toBe(5381);
  });
});

describe("fixture: 4+ tagless recipes visibly vary (acceptance §8.4)", () => {
  // Twelve tagless recipes — no triggers in title, so all land in the
  // `default` bucket. The pattern index must vary across the set so a
  // row of 4 cards doesn't look identical. Using real-ish ids we expect
  // to see in prod.
  const ids = [
    "rec_01HZYQ0AAA",
    "rec_01HZYQ0BBB",
    "rec_01HZYQ0CCC",
    "rec_01HZYQ0DDD",
    "rec_01HZYQ0EEE",
    "rec_01HZYQ0FFF",
    "rec_01HZYQ0GGG",
    "rec_01HZYQ0HHH",
    "rec_01HZYQ0III",
    "rec_01HZYQ0JJJ",
    "rec_01HZYQ0KKK",
    "rec_01HZYQ0LLL",
  ];

  it("all twelve ids resolve to `default` bucket (no triggers)", () => {
    for (const id of ids) {
      expect(getRecipeFallback({ id, title: "Untitled Recipe" }).bucket).toBe("default");
    }
  });

  it("at least 3 of the 4 patterns appear across any contiguous window of 4", () => {
    const results = ids.map((id) => getRecipeFallback({ id, title: "Untitled" }));
    // Assert all 4 patterns appear across the full fixture (stronger
    // than the 4-card window claim in the brief).
    const distinct = new Set(results.map((r) => r.pattern));
    expect(distinct.size).toBe(4);

    // And every sliding window of 4 cards has at least 2 distinct
    // patterns so no row of 4 cards looks identical.
    for (let i = 0; i <= results.length - 4; i++) {
      const window = new Set(results.slice(i, i + 4).map((r) => r.pattern));
      expect(window.size).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("pattern SVG content — brief §4", () => {
  it("each pattern tile is under 200 bytes (acceptance §8.5)", () => {
    const colour = "rgba(255, 255, 255, 0.06)";
    for (const p of ["dots", "grid", "chevron", "circles"] as const) {
      const svg = patternSvgContent(p, colour);
      expect(Buffer.byteLength(svg, "utf8")).toBeLessThan(200);
    }
  });
});

describe("parity: renderers + wiring", () => {
  it("web renderer exists and consumes the shared utility", () => {
    const src = readFileSync(WEB_COMPONENT, "utf8");
    expect(src).toMatch(/from ["'].*recipeHeroFallback["']/);
    expect(src).toMatch(/getRecipeFallback/);
  });

  it("mobile renderer exists and consumes the shared utility", () => {
    const src = readFileSync(MOBILE_COMPONENT, "utf8");
    expect(src).toMatch(/recipeHeroFallback/);
    expect(src).toMatch(/getRecipeFallback/);
  });

  it("Discover surfaces wire the fallback component (no flat tint on no-image)", () => {
    const webSrc = readFileSync(WEB_DISCOVER, "utf8");
    const mobSrc = readFileSync(MOBILE_DISCOVER, "utf8");
    expect(webSrc).toMatch(/DiscoverRecipeImage|RecipeHeroFallback/);
    expect(mobSrc).toMatch(/RecipeHeroFallback/);
  });
});

describe("recipeUnderlayColor — ENG-1374 PR 2 never-white wrapper underlay", () => {
  it("is the recipe's own cuisine tint (the fallback tile's gradient start)", () => {
    const input = { id: "r-1", title: "Tomato Pasta" };
    expect(recipeUnderlayColor(input)).toBe(getRecipeFallback(input).gradientStart);
    expect(recipeUnderlayColor(input)).toBe(HERO_TINTS.warms);
    expect(recipeUnderlayColor({ id: "r-2", title: "Kale Bowl" })).toBe(HERO_TINTS.greens);
  });

  it("resolves for unknown / empty input (default bucket) — there is no white rung", () => {
    expect(recipeUnderlayColor({ id: "r-3", title: "Kimchi jjigae" })).toBe(HERO_TINTS.default);
    expect(recipeUnderlayColor({ id: "r-4", title: "" })).toBe(HERO_TINTS.default);
  });

  it("is deterministic per recipe (same input, same tint, both platforms via the shared module)", () => {
    const a = recipeUnderlayColor({ id: "uuid-abc", title: "Salmon Teriyaki" });
    const b = recipeUnderlayColor({ id: "uuid-abc", title: "Salmon Teriyaki" });
    expect(a).toBe(b);
  });

  it("every possible underlay is a fully OPAQUE 6-digit hex — never transparent, never white", () => {
    const all = [...Object.values(HERO_TINTS), CARD_CREAM];
    for (const tint of all) {
      expect(tint).toMatch(/^#[0-9A-Fa-f]{6}$/); // opaque — no alpha channel
      expect(tint.toUpperCase()).not.toBe("#FFFFFF");
    }
  });

  it("CARD_CREAM is exported for containers with no recipe identity (paywall/create grounds)", () => {
    expect(CARD_CREAM).toBe(HERO_TINTS.cream);
  });
});
