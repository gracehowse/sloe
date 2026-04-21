/**
 * Recipe card fit-percent badge — 2026-04-20 prototype port.
 *
 * History:
 *   - F-11 (TestFlight `AA63DQ7xd2gRhdjC3L7gjtE`, 2026-04-19) removed
 *     the per-card "Great / Good / Warn" macro-fit badge because the
 *     underlying `fit` field was never populated (always rendered
 *     "Good"). Tester feedback: "score seems irrelevant".
 *   - 2026-04-20: Grace sent a design prototype screenshot with a
 *     primary-tinted `{N}%` pill top-right of the hero-card body and
 *     said "add this". This overrides F-11. The new badge shows the
 *     concrete fit percent from the shared `computeRecipeFitPercent`
 *     helper so web + mobile can't drift, and the helper is
 *     deterministic / test-covered.
 *
 * This test replaces `recipeCardNoScore.test.ts` (deleted) and pins:
 *   - both Discover surfaces render a fit-percent pill on hero cards
 *   - both surfaces import and use the shared helper
 *   - the per-card test-id is present so visual QA can assert on it
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

describe("2026-04-20 fit-percent badge is present on Discover hero cards", () => {
  it("web DiscoverFeed imports the shared computeRecipeFitPercent helper", () => {
    expect(WEB_DISCOVER_SRC).toMatch(
      /from\s+["'][^"']*recipeFitPercent(?:\.ts)?["']/,
    );
    expect(WEB_DISCOVER_SRC).toMatch(/computeRecipeFitPercent\(/);
  });

  it("web DiscoverFeed renders the fit-percent pill with a per-recipe test id", () => {
    expect(WEB_DISCOVER_SRC).toMatch(/discover-hero-fit-\$\{recipe\.id\}/);
    // The prototype specifies `{N}%` — so a "%" suffix must appear
    // next to the rendered fitPct.
    expect(WEB_DISCOVER_SRC).toMatch(/\{fitPct\}%/);
  });

  it("mobile Discover imports the shared computeRecipeFitPercent helper", () => {
    expect(MOBILE_DISCOVER_SRC).toMatch(
      /from\s+["'][^"']*recipeFitPercent["']/,
    );
    expect(MOBILE_DISCOVER_SRC).toMatch(/computeRecipeFitPercent\(/);
  });

  it("mobile Discover renders the fit-percent pill with a per-recipe test id", () => {
    expect(MOBILE_DISCOVER_SRC).toMatch(/discover-hero-fit-\$\{item\.id\}/);
    expect(MOBILE_DISCOVER_SRC).toMatch(/\{fitPct\}%/);
  });

  it("mobile More-ideas rows use the lucide ChefHat glyph (prototype literal)", () => {
    // Post design-system sweep 2026-04-21 (R4): mobile Discover migrated
    // from MaterialCommunityIcons `chef-hat` to lucide `ChefHat` to match
    // the web side and the Claude Design prototype icon set.
    expect(MOBILE_DISCOVER_SRC).toMatch(/<ChefHat\s/);
  });

  it("web More-ideas rows keep using the lucide ChefHat (via Icons.chef)", () => {
    expect(WEB_DISCOVER_SRC).toMatch(/Icons\.chef\b/);
  });

  it("shared helper is pure and exports both the typed + thin wrappers", () => {
    expect(HELPER_SRC).toMatch(/export function computeRecipeFitPercent\(/);
    expect(HELPER_SRC).toMatch(/export function recipeFitPercent\(/);
  });
});
