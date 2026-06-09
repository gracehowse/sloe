/**
 * Today surface — Figma `654:2` flat borderless slab on web.
 *
 * Resting Today cards use `elevation="slab-flat"` on `SupprCard` or the
 * `.card-slab-flat` utility (no shadow, no hairline). Other tabs keep
 * `.card-slab` soft lift.
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
const NORTH_STAR = read("src/app/components/suppr/north-star-block.tsx");
const HYDRATION = read("src/app/components/suppr/hydration-stimulants-card.tsx");
const MACRO_TILES = read("src/app/components/suppr/today-dashboard-macro-tiles.tsx");
const QUICK_LOG = read("src/app/components/suppr/today-quick-log-strip.tsx");
const RIGHT_RAIL = read("src/app/components/suppr/today-desktop-right-rail.tsx");

const IMPORT = 'import { SupprCard } from "../ui/suppr-card.tsx"';
const SLAB_FLAT = 'elevation="slab-flat"';
const CARD_SLAB_FLAT = "card-slab-flat";

describe("Today card-elevation sweep — hero ring card", () => {
  it("imports + uses SupprCard for the mobile-web hero card", () => {
    expect(HERO_RING).toContain(IMPORT);
    expect(HERO_RING).toContain("<SupprCard");
    // Audit gap 6 (2026-06-09): hero ring was deliberately upgraded from
    // slab-flat to `elevation="card"` (soft shadow) so it separates from the
    // #F6F5F2-on-#FFFFFF page background. This mirrors mobile `lift="soft"`.
    // The desktop hero (today-hero-stats.tsx) stays slab-flat — its test is unchanged.
    expect(HERO_RING).toContain('elevation="card"');
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
    expect(HERO_STATS).toContain(SLAB_FLAT);
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
    expect(MACRO_BARS).toContain(SLAB_FLAT);
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
    expect(MEALS).toContain(SLAB_FLAT);
    expect(MEALS).not.toContain('elevation="card"');
    expect(MEALS).not.toContain("card-slab ");
  });
  it("no longer hand-rolls the flat `rounded-card bg-card border border-border overflow-hidden` containers", () => {
    expect(MEALS).not.toContain(
      "rounded-card bg-card border border-border overflow-hidden",
    );
  });
});

describe("Today flat slab — north star, hydration, macro tiles", () => {
  it("north-star SupprCards use slab-flat", () => {
    expect(NORTH_STAR).toContain(SLAB_FLAT);
    expect(NORTH_STAR).not.toContain('elevation="card"');
  });

  it("hydration card uses card-slab-flat", () => {
    expect(HYDRATION).toContain(CARD_SLAB_FLAT);
    expect(HYDRATION).not.toContain("card-slab ");
  });

  it("macro tiles use card-slab-flat", () => {
    expect(MACRO_TILES).toContain(CARD_SLAB_FLAT);
    expect(MACRO_TILES).not.toContain("card-slab ");
  });
});

describe("Today card fill — Figma surface.card", () => {
  it("theme.css --card is #F6F5F2 (not the darker #ECECEA interim)", () => {
    const theme = read("src/styles/theme.css");
    expect(theme).toMatch(/:root[\s\S]*?--card:\s*#F6F5F2/i);
    expect(theme).not.toMatch(/--card:\s*#ECECEA/i);
  });
});

describe("Today card shape — 24px rounded-card on web", () => {
  it("macro tiles use rounded-card (not 14px)", () => {
    expect(MACRO_TILES).toContain("rounded-card");
    expect(MACRO_TILES).not.toContain("rounded-[14px]");
  });

  it("quick-log chips use rounded-card (not rounded-xl)", () => {
    expect(QUICK_LOG).toContain("rounded-card");
    expect(QUICK_LOG).not.toMatch(/rounded-xl\s+bg-card/);
  });

  it("desktop right-rail slabs use rounded-card (not rounded-2xl)", () => {
    expect(RIGHT_RAIL).toContain("rounded-card");
    expect(RIGHT_RAIL).not.toMatch(/rounded-2xl\s+bg-card/);
  });
});
