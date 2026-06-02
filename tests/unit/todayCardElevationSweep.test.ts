/**
 * Today surface — flat resting cards routed through the canonical SupprCard
 * (Design Direction 2026, ENG-795 card-elevation sweep).
 *
 * The design-director root-cause was that the Today spine rendered bare
 * `bg-card border` divs with zero elevation-flag consumption — `SupprCard` was
 * consumed in 2 files vs ~278 hand-rolled card divs. This sweep routes the
 * Today surface's truly-flat resting cards through `SupprCard` so they adopt
 * the soft ambient elevation (and drop the hairline border) when
 * `design_system_elevation` is ON, and stay flat byte-for-byte when OFF — the
 * flag-gating lives INSIDE `SupprCard`, so the call sites just use the
 * primitive (no flag read here).
 *
 * Source-text assertions (same convention as
 * `mealPlannerElevationAndWinPulse.test.ts`). They break if a converted card
 * regresses back to a hand-rolled `bg-card border` div, or the SupprCard
 * import is dropped.
 *
 * NOTE — out of scope by design: cards already wearing the legacy always-on
 * `card-elevated` utility are NOT converted here, because SupprCard's flag-OFF
 * tier is flatter than `card-elevated` and converting them would change the
 * flag-off render (a regression vs the byte-for-byte rule). They are tracked as
 * a follow-up elevation-preserving migration, not silently changed.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

const HERO_RING = read("src/app/components/suppr/today-hero-ring.tsx");
const HERO_STATS = read("src/app/components/suppr/today-hero-stats.tsx");
const MACRO_BARS = read("src/app/components/suppr/today-dashboard-macro-bars.tsx");
const MEALS = read("src/app/components/suppr/today-meals-section.tsx");

const IMPORT = 'import { SupprCard } from "../ui/suppr-card.tsx"';

describe("Today card-elevation sweep — hero ring card", () => {
  it("imports + uses SupprCard for the mobile-web hero card", () => {
    expect(HERO_RING).toContain(IMPORT);
    expect(HERO_RING).toContain("<SupprCard");
  });
  it("no longer hand-rolls the flat hero card div", () => {
    expect(HERO_RING).not.toContain(
      "rounded-card border border-border bg-card px-4 py-3",
    );
  });
});

describe("Today card-elevation sweep — desktop hero card", () => {
  it("imports + uses SupprCard and preserves the testid", () => {
    expect(HERO_STATS).toContain(IMPORT);
    expect(HERO_STATS).toContain("<SupprCard");
    expect(HERO_STATS).toContain('data-testid="today-hero-desktop"');
  });
  it("no longer hand-rolls the flat desktop hero card div", () => {
    expect(HERO_STATS).not.toContain(
      "hidden md:block mb-3 rounded-card border border-border bg-card px-4 py-4",
    );
  });
});

describe("Today card-elevation sweep — macro bars card", () => {
  it("imports + uses SupprCard and preserves the testid", () => {
    expect(MACRO_BARS).toContain(IMPORT);
    expect(MACRO_BARS).toContain("<SupprCard");
    expect(MACRO_BARS).toContain('data-testid="today-macro-bars"');
  });
  it("no longer hand-rolls the flat macro-bars card div", () => {
    expect(MACRO_BARS).not.toContain(
      "bg-card border border-border rounded-2xl p-3 mb-2 flex flex-col gap-3",
    );
  });
});

describe("Today card-elevation sweep — meals-section containers", () => {
  it("imports SupprCard and routes BOTH the quick-add + meals-list containers through it", () => {
    expect(MEALS).toContain(IMPORT);
    // Two flat containers were converted (quick-add + the meals list).
    const opens = MEALS.match(/<SupprCard/g) ?? [];
    expect(opens.length).toBeGreaterThanOrEqual(2);
  });
  it("no longer hand-rolls the flat `rounded-card bg-card border border-border overflow-hidden` containers", () => {
    expect(MEALS).not.toContain(
      "rounded-card bg-card border border-border overflow-hidden",
    );
  });
});
