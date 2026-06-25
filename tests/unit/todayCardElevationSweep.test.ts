/**
 * Today surface — card elevation, one treatment per surface.
 *
 * Re-pinned to the "one card treatment" rule (Grace 2026-06-09,
 * `docs/decisions/2026-06-09-one-card-treatment-soft-elevation.md`):
 * every card that sits directly on the page ground uses the SOFT lift —
 * `.card-slab` (web) / `elevation="card"` on `SupprCard`. Cards nested
 * INSIDE another card/sheet stay FLAT (`.card-slab-flat` /
 * `elevation="slab-flat"`) so they never double-shadow.
 *
 * Page-ground Today cards re-pinned to soft here: the meals-section
 * containers (quick-add + each meal slot + empty state) and the hydration
 * card. Surfaces NOT in the 2026-06-09 web sweep keep their prior treatment
 * (the desktop hero stat block, the macro-bars card, the north-star block,
 * and the 2×2 macro tiles — the macro tiles stay flat this session per the
 * sweep scope). The SupprCard DEFAULT stays flat (the system contract,
 * pinned by `supprPrimitives` + `cardElevationVariants`).
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
const CARD_ELEVATION = 'elevation="card"';
const CARD_SLAB_FLAT = "card-slab-flat";

describe("Today card-elevation sweep — hero ring card", () => {
  it("imports + uses SupprCard for the mobile-web hero card", () => {
    expect(HERO_RING).toContain(IMPORT);
    expect(HERO_RING).toContain("<SupprCard");
    // Audit gap 6 (2026-06-09): hero ring was deliberately upgraded from
    // slab-flat to `elevation="card"` (soft shadow) so it separates from the
    // #F6F5F2-on-#FFFFFF page background. This mirrors mobile `lift="soft"`.
    // The desktop hero (today-hero-stats.tsx) is also soft (one-treatment).
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
    // One-treatment (Grace 2026-06-09): page-ground hero lifts soft.
    expect(HERO_STATS).toContain(CARD_ELEVATION);
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
    // One-treatment (Grace 2026-06-09): page-ground card lifts soft.
    expect(MACRO_BARS).toContain(CARD_ELEVATION);
    expect(MACRO_BARS).toContain('data-testid="today-macro-bars"');
  });
  it("no longer hand-rolls the flat macro-bars card div", () => {
    expect(MACRO_BARS).not.toContain(
      "bg-card border border-border rounded-2xl p-3 mb-2 flex flex-col gap-3",
    );
  });
});

describe("Today card-elevation sweep — meals-section containers", () => {
  it("imports SupprCard and routes the page-ground containers through it with SOFT lift", () => {
    expect(MEALS).toContain(IMPORT);
    // Page-ground containers (quick-add + each meal slot + empty state).
    const opens = MEALS.match(/<SupprCard/g) ?? [];
    expect(opens.length).toBeGreaterThanOrEqual(2);
    // One-treatment (Grace 2026-06-09): these page-ground cards lift soft.
    expect(MEALS).toContain('elevation="card"');
    // The only remaining flat class is the usual-picker row, which is
    // NESTED inside the picker dialog sheet — a card-in-a-surface stays flat.
    expect(MEALS).toContain(CARD_SLAB_FLAT);
  });
  it("no longer hand-rolls the flat `rounded-card bg-card border border-border overflow-hidden` containers", () => {
    expect(MEALS).not.toContain(
      "rounded-card bg-card border border-border overflow-hidden",
    );
  });
});

describe("Today elevation — north star + macro tiles + hydration all soft", () => {
  // One-treatment (Grace 2026-06-09): every page-ground Today card lifts
  // soft — including north-star + the 2×2 macro tiles, in parity with the
  // flipped mobile twins (NorthStarBlock / TodayDashboardMacroTiles).
  it("north-star SupprCards lift soft", () => {
    expect(NORTH_STAR).toContain(CARD_ELEVATION);
    expect(NORTH_STAR).not.toContain(SLAB_FLAT);
  });

  it("hydration card uses the SOFT card-slab (one-treatment, Grace 2026-06-09)", () => {
    // Two page-ground hydration/stimulants sections both lift soft now.
    expect(HYDRATION).toContain("card-slab ");
    expect(HYDRATION).not.toContain(CARD_SLAB_FLAT);
  });

  it("macro tiles are a hairline grid, NOT a lifted card (Grace 2026-06-25)", () => {
    // The tiles variant conformed to the prototype's `.mtile`: a hairline-
    // divided grid (no card fill, no lift) — top border on the grid, bottom
    // border each cell. Supersedes the card-slab tile.
    expect(MACRO_TILES).toContain("border-t border-border");
    expect(MACRO_TILES).toContain("border-b border-border");
    expect(MACRO_TILES).not.toContain("card-slab ");
  });
});

describe("Today card fill — Sloe v3 white-ground elevation model", () => {
  it("theme.css light is pure white ground + white cards that LIFT on a layered shadow (v3, 2026-06-21)", () => {
    // Sloe v3 (docs/ux/redesign/v3) reverses the 2026-06-12 flat-card-on-cream
    // grammar: the in-product ground returns to PURE WHITE and white cards
    // separate via `--elev-card-soft` ("elevation, not warmth"). Cream is now
    // marketing-only (`--background-marketing`).
    const theme = read("src/styles/theme.css");
    expect(theme).toMatch(/:root[\s\S]*?--background:\s*#FFFFFF/i);
    expect(theme).toMatch(/:root[\s\S]*?--card:\s*#FFFFFF/i);
    expect(theme).toMatch(/--background-grouped:\s*#F5F4F7/i);
    expect(theme).toMatch(/--background-marketing:\s*#FBF8F3/i);
    // The resting card-slab lifts (no longer flat box-shadow: none).
    expect(theme).toMatch(/\.card-slab\s*\{[\s\S]*?box-shadow:\s*var\(--elev-card-soft\)/i);
  });
});

describe("Today card shape — 24px rounded-card on web", () => {
  it("macro tiles render as a borderless 2-col hairline grid (Grace 2026-06-25)", () => {
    // The tile grid conformed to the prototype `.mtiles`: a 2-col grid divided
    // by hairlines, no rounded card on the cells, no 14px tile.
    expect(MACRO_TILES).toContain("grid grid-cols-2 border-t border-border");
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
