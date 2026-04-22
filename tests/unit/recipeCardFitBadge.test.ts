/**
 * Recipe card fit-percent badge — removal pin.
 *
 * History:
 *   - F-11 (2026-04-19): fit badge removed — "Good" always rendered, so it
 *     read as decorative noise.
 *   - 2026-04-20 prototype port: re-added as a primary-tinted `{N}%` pill.
 *   - F-45 (2026-04-22): removed again after repeated tester feedback on
 *     builds 20 + 21 ("Score means nothing — remove"). The helper itself
 *     stays because it may be useful for future ranking.
 *
 * This test pins the *removal* so nobody reintroduces the pill without
 * touching this file (and therefore thinking about the feedback history).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const WEB_DISCOVER_PATH = resolve(ROOT, "src/app/components/DiscoverFeed.tsx");
const MOBILE_DISCOVER_PATH = resolve(ROOT, "apps/mobile/app/(tabs)/discover.tsx");
const HELPER_PATH = resolve(ROOT, "src/lib/nutrition/recipeFitPercent.ts");

const WEB_DISCOVER_SRC = readFileSync(WEB_DISCOVER_PATH, "utf8");
const MOBILE_DISCOVER_SRC = readFileSync(MOBILE_DISCOVER_PATH, "utf8");
const HELPER_SRC = readFileSync(HELPER_PATH, "utf8");

describe("F-45 — fit-percent pill is NOT rendered on Discover hero cards", () => {
  it("web DiscoverFeed does not render the fit-percent pill", () => {
    // Neither the test id nor the `{fitPct}%` JSX should appear.
    expect(WEB_DISCOVER_SRC).not.toMatch(/discover-hero-fit-\$\{recipe\.id\}/);
    expect(WEB_DISCOVER_SRC).not.toMatch(/\{fitPct\}%/);
  });

  it("mobile Discover does not render the fit-percent pill", () => {
    expect(MOBILE_DISCOVER_SRC).not.toMatch(/discover-hero-fit-\$\{item\.id\}/);
    expect(MOBILE_DISCOVER_SRC).not.toMatch(/\{fitPct\}%/);
  });

  it("mobile More-ideas rows still use the lucide ChefHat glyph", () => {
    expect(MOBILE_DISCOVER_SRC).toMatch(/<ChefHat\s/);
  });

  it("web More-ideas rows still use the lucide ChefHat (via Icons.chef)", () => {
    expect(WEB_DISCOVER_SRC).toMatch(/Icons\.chef\b/);
  });

  it("shared helper is still exported (kept for future ranking)", () => {
    expect(HELPER_SRC).toMatch(/export function computeRecipeFitPercent\(/);
    expect(HELPER_SRC).toMatch(/export function recipeFitPercent\(/);
  });
});
