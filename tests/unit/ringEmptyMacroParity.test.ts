/**
 * ENG-1093 — empty + Show-macros parity, and the equal-width macro toggle.
 *
 * Grace 2026-06-13: "hide macros / show macros should be the same width and
 * empty should also be the same width. empty with show rings should look
 * exactly like the populated one just with it unpopulated."
 *
 * Two contracts, verified structurally across BOTH platforms (one spec in the
 * shared web vitest run — same pattern as `ringEmptyGradient.test.ts`):
 *
 *   1. Empty + macros SHOWN renders the populated multi-ring UNPOPULATED
 *      (calorie track + 3 grey macro tracks), not the single cold-open loop.
 *      The ENG-1086 loop is scoped to the COLLAPSED empty state. Gated on
 *      `ring_empty_macro_parity_v1` (default-on); off → pre-ENG-1093 (empty
 *      always shows the single loop).
 *   2. The "Hide macros" / "Show macros" toggle has ONE fixed width so the
 *      centred control never wobbles between states.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");

const SKIA_SRC = read("apps/mobile/components/charts/SkiaRingArcs.tsx");
const HOST_SRC = read("apps/mobile/components/charts/CalorieRing.tsx");
const WEB_RING_SRC = read("src/app/components/suppr/daily-ring.tsx");
const MOBILE_HERO = read("apps/mobile/components/today/TodayHeroRing.tsx");
const WEB_HERO = read("src/app/components/suppr/today-hero-ring.tsx");
const WEB_FLAGS = read("src/lib/analytics/track.ts");
const MOBILE_FLAGS = read("apps/mobile/lib/analytics.ts");

describe("ENG-1093 — empty + Show-macros parity flag", () => {
  it("registers `ring_empty_macro_parity_v1` default-on on both platforms", () => {
    expect(WEB_FLAGS).toMatch(/"ring_empty_macro_parity_v1"/);
    expect(MOBILE_FLAGS).toMatch(/"ring_empty_macro_parity_v1"/);
  });
});

describe("ENG-1093 — empty multi-ring parity (mobile)", () => {
  it("host scopes the cold-open loop to collapsed-empty via `showEmptyLoop`", () => {
    expect(HOST_SRC).toMatch(/isFeatureEnabled\("ring_empty_macro_parity_v1"\)/);
    expect(HOST_SRC).toMatch(
      /showEmptyLoop = isEmpty && emptyGradientOn && !\(emptyMacroParityOn && expanded\)/,
    );
    // The loop's stroke + gradient ride `showEmptyLoop`, not raw `isEmpty`.
    expect(HOST_SRC).toMatch(/STROKE: showEmptyLoop \? emptyBoldStroke : STROKE/);
    expect(HOST_SRC).toMatch(/emptyGradient=\{showEmptyLoop\}/);
    expect(HOST_SRC).toMatch(/emptyMacroParity=\{emptyMacroParityOn\}/);
  });

  it("host gates the SVG-fallback empty hairline off when macros are shown", () => {
    expect(HOST_SRC).toMatch(/isEmpty && !\(emptyMacroParityOn && expanded\) \?/);
  });

  it("Skia renders the unpopulated macro tracks when macros shown on empty", () => {
    expect(SKIA_SRC).toMatch(
      /emptyShowsMacros = isEmpty && expanded && emptyMacroParity/,
    );
    expect(SKIA_SRC).toMatch(/expanded && \(!isEmpty \|\| emptyShowsMacros\)/);
    // …and drops the cold-open hairline in that state.
    expect(SKIA_SRC).toMatch(/isEmpty && !emptyShowsMacros \?/);
  });
});

describe("ENG-1093 — empty multi-ring parity (web)", () => {
  it("scopes the cold-open loop to collapsed-empty + shows unpopulated tracks", () => {
    expect(WEB_RING_SRC).toMatch(/isFeatureEnabled\("ring_empty_macro_parity_v1"\)/);
    expect(WEB_RING_SRC).toMatch(
      /emptyShowsMacros = isEmpty && expanded && emptyMacroParityOn/,
    );
    expect(WEB_RING_SRC).toMatch(
      /showEmptyGradient = isEmpty && emptyGradientOn && !emptyShowsMacros/,
    );
    expect(WEB_RING_SRC).toMatch(
      /expanded && \(!isEmpty \|\| emptyShowsMacros\) && macroRings\.map/,
    );
    expect(WEB_RING_SRC).toMatch(/isEmpty && !emptyShowsMacros \?/);
  });
});

describe("ENG-1093 — equal-width macro toggle (no wobble)", () => {
  it("mobile pins the toggle label to one centred width", () => {
    expect(MOBILE_HERO).toMatch(/minWidth: 84/);
    expect(MOBILE_HERO).toMatch(/textAlign: "center"/);
  });

  it("web pins the toggle button to one centred width", () => {
    expect(WEB_HERO).toMatch(/min-w-\[84px\]/);
    expect(WEB_HERO).toMatch(/text-center/);
  });
});
