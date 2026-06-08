/**
 * FROST secondary-colour direction — FLAG-GATED (`brand_frost_secondary`).
 *
 * Exploration only (`docs/brand/2026-06-07-secondary-colour-exploration.md`).
 * The `.flag-frost` class on `<html>` (applied by `FrostFlagToggle` once PostHog
 * flags resolve) moves ONLY the secondary accent clay → Damson; every other
 * token cascades unchanged via `var()`. This test is the regression guard:
 *
 *   1. The `.flag-frost` (light) + `.dark.flag-frost` (dark) blocks redefine the
 *      expected secondary-accent tokens with the expected values.
 *   2. Carbs / sugar / chart-3 are NEVER inside either override block — they
 *      must stay clay in BOTH flag states.
 *   3. The flag is NOT in `REDESIGN_DEFAULT_ON` (the old clay path stays the
 *      default; the flag ramps later via PostHog).
 *
 * Web mirror of `apps/mobile/tests/unit/accentTokens.test.ts`
 * (`AccentFrost` / `AccentWinGradientFrost`).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const THEME_CSS = readFileSync(resolve(ROOT, "src/styles/theme.css"), "utf8");
const TRACK_TS = readFileSync(
  resolve(ROOT, "src/lib/analytics/track.ts"),
  "utf8",
);

/** Extract the body of a single-selector CSS rule by its opening selector text. */
function ruleBody(selectorOpen: string): string {
  const idx = THEME_CSS.indexOf(selectorOpen);
  expect(idx, `rule "${selectorOpen}" missing in theme.css`).toBeGreaterThanOrEqual(0);
  const open = THEME_CSS.indexOf("{", idx);
  let depth = 1;
  let i = open + 1;
  while (i < THEME_CSS.length && depth > 0) {
    const ch = THEME_CSS[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
    i += 1;
  }
  return THEME_CSS.slice(open + 1, i - 1);
}

function readVar(body: string, name: string): string | null {
  const m = body.match(new RegExp(`--${name}:\\s*([^;]+);`));
  return m ? m[1].trim().toLowerCase() : null;
}

const LIGHT = ruleBody(".flag-frost {");
// The dark override is a grouped selector — anchor on the first selector.
const DARK = ruleBody(".dark.flag-frost,");

describe("Frost flag — .flag-frost (light) overrides", () => {
  it("redefines the secondary-accent tokens to Damson", () => {
    expect(readVar(LIGHT, "accent-primary")).toBe("#6a4b7a");
    expect(readVar(LIGHT, "accent-primary-solid")).toBe("#54356a");
    expect(readVar(LIGHT, "accent-primary-soft")).toBe("rgba(106, 75, 122, 0.10)");
    expect(readVar(LIGHT, "accent-primary-ring")).toBe("rgba(106, 75, 122, 0.22)");
    expect(readVar(LIGHT, "accent-muted")).toBe("rgba(106, 75, 122, 0.12)");
    expect(readVar(LIGHT, "sidebar-ring")).toBe("#6a4b7a");
    expect(readVar(LIGHT, "north-star-bg-to")).toBe("rgba(106, 75, 122, 0.05)");
    expect(readVar(LIGHT, "elev-float-primary")).toBe(
      "0 4px 16px rgba(106, 75, 122, 0.40)",
    );
    expect(readVar(LIGHT, "accent-win-gradient")).toBe(
      "linear-gradient(120deg, #3b2a4d 0%, #6a4b7a 50%, #d6a24a 100%)",
    );
  });

  it("does NOT redefine carbs / sugar / chart-3 (they stay clay)", () => {
    expect(readVar(LIGHT, "macro-carbs")).toBeNull();
    expect(readVar(LIGHT, "macro-carbs-soft")).toBeNull();
    expect(readVar(LIGHT, "macro-sugar")).toBeNull();
    expect(readVar(LIGHT, "macro-sugar-soft")).toBeNull();
    expect(readVar(LIGHT, "chart-3")).toBeNull();
  });

  it("does NOT touch status / honey / nav tokens", () => {
    expect(readVar(LIGHT, "accent-success")).toBeNull();
    expect(readVar(LIGHT, "accent-warning")).toBeNull();
    expect(readVar(LIGHT, "accent-destructive")).toBeNull();
    expect(readVar(LIGHT, "over-budget-fg")).toBeNull();
    expect(readVar(LIGHT, "activity")).toBeNull();
    expect(readVar(LIGHT, "sidebar-primary")).toBeNull();
    expect(readVar(LIGHT, "brand-mark-ring")).toBeNull();
  });
});

describe("Frost flag — .dark.flag-frost overrides", () => {
  it("redefines the secondary-accent tokens to lifted Damson", () => {
    expect(readVar(DARK, "accent-primary")).toBe("#9a7baa");
    expect(readVar(DARK, "accent-primary-solid")).toBe("#b6acc6");
    expect(readVar(DARK, "accent-primary-soft")).toBe("rgba(154, 123, 170, 0.16)");
    expect(readVar(DARK, "accent-primary-ring")).toBe("rgba(154, 123, 170, 0.30)");
    expect(readVar(DARK, "accent-muted")).toBe("rgba(154, 123, 170, 0.15)");
    expect(readVar(DARK, "sidebar-ring")).toBe("#9a7baa");
    expect(readVar(DARK, "north-star-bg-to")).toBe("rgba(154, 123, 170, 0.06)");
    expect(readVar(DARK, "elev-float-primary")).toBe(
      "0 4px 16px rgba(154, 123, 170, 0.45)",
    );
    expect(readVar(DARK, "accent-win-gradient")).toBe(
      "linear-gradient(120deg, #815e91 0%, #9a7baa 50%, #e0b25e 100%)",
    );
  });

  it("does NOT redefine carbs / sugar / chart-3 in dark either", () => {
    expect(readVar(DARK, "macro-carbs")).toBeNull();
    expect(readVar(DARK, "macro-sugar")).toBeNull();
    expect(readVar(DARK, "chart-3")).toBeNull();
  });
});

describe("Frost flag — rollout posture", () => {
  it("brand_frost_secondary is NOT in REDESIGN_DEFAULT_ON (ramps via PostHog)", () => {
    // The flag must NOT appear inside the REDESIGN_DEFAULT_ON Set literal — the
    // whole point is the clay path stays the default until a deliberate ramp.
    const setStart = TRACK_TS.indexOf("REDESIGN_DEFAULT_ON = new Set");
    expect(setStart).toBeGreaterThanOrEqual(0);
    const setEnd = TRACK_TS.indexOf("]);", setStart);
    const setBody = TRACK_TS.slice(setStart, setEnd);
    expect(setBody).not.toContain("brand_frost_secondary");
  });
});
