/**
 * Settings — macro widget swatches match canonical theme tokens
 * (audit 2026-04-30 P0-3).
 *
 * Pre-fix the `WIDGET_MACRO_OPTIONS` array used hardcoded hexes
 * (#5B8DEF / #F5A623 / #E05C5C / #22c55e / #D87FE8 / #7FB5E8 /
 * #4FC3F7) that drifted from the macro tokens in
 * `src/styles/theme.css`. The dashboard rings, macro tiles, and
 * progress charts all read from `--macro-protein` / `--macro-carbs` /
 * `--macro-fat` / `--success` / `--macro-water`, so the Settings
 * picker showed swatches that didn't match the colours users would
 * actually see on Today.
 *
 * The fix routes Settings through `MACRO_COLOR_VARS` (CSS-var
 * references — auto dark-mode swap) and pins a parallel
 * `MACRO_COLORS_LIGHT` map of hexes for the cases where a runtime
 * style or canvas/SVG fill needs the literal colour. Both must match
 * the canonical tokens declared in the `:root` block of theme.css.
 *
 * Drift between any of:
 *   - theme.css `:root { --macro-* }`
 *   - `src/lib/theme/macroColors.ts` MACRO_COLORS_LIGHT
 *   - the Settings WIDGET_MACRO_OPTIONS surface
 * will fail this test.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MACRO_COLORS_LIGHT,
  MACRO_COLOR_VARS,
} from "../../src/lib/theme/macroColors";

const ROOT = resolve(__dirname, "..", "..");
const THEME_PATH = resolve(ROOT, "src/styles/theme.css");
const SETTINGS_PATH = resolve(ROOT, "src/app/components/Settings.tsx");
const TODAY_MACRO_TILES_PATH = resolve(
  ROOT,
  "src/app/components/suppr/today-dashboard-macro-tiles.tsx",
);
const todayMacroTilesSrc = readFileSync(TODAY_MACRO_TILES_PATH, "utf8");

const themeCss = readFileSync(THEME_PATH, "utf8");
const settingsSrc = readFileSync(SETTINGS_PATH, "utf8");

/** Slice the `:root { … }` block from theme.css by counting balanced
 *  braces. A simple `\{[\s\S]*?\}` regex stops at the first `}` it
 *  finds, which inside the file's leading comment is a `})` inside
 *  `withSpring({ damping: 18, stiffness: 220, mass: 0.9 })`. We need
 *  the actual top-level block close. */
function rootBlock(): string {
  const idx = themeCss.indexOf(":root");
  expect(idx, "theme.css missing :root block").toBeGreaterThanOrEqual(0);
  const open = themeCss.indexOf("{", idx);
  expect(open).toBeGreaterThan(idx);
  let depth = 1;
  let i = open + 1;
  while (i < themeCss.length && depth > 0) {
    const ch = themeCss[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
    i += 1;
  }
  expect(depth, ":root block never closed").toBe(0);
  return themeCss.slice(open + 1, i - 1);
}

const ROOT_BLOCK = rootBlock();

/** Pull a `--var-name: #hex;` value from the `:root` block — strictly
 *  scoped to `:root` so dark-mode declarations don't shadow it. */
function readRootVar(name: string): string {
  const m = ROOT_BLOCK.match(new RegExp(`--${name}:\\s*([^;]+);`));
  expect(m, `Expected --${name} in :root`).not.toBeNull();
  return m![1].trim();
}

describe("MACRO_COLORS_LIGHT pins canonical theme.css :root values", () => {
  it("protein matches --macro-protein", () => {
    expect(MACRO_COLORS_LIGHT.protein).toBe(readRootVar("macro-protein"));
  });

  it("carbs matches --macro-carbs", () => {
    expect(MACRO_COLORS_LIGHT.carbs).toBe(readRootVar("macro-carbs"));
  });

  it("fat matches --macro-fat", () => {
    expect(MACRO_COLORS_LIGHT.fat).toBe(readRootVar("macro-fat"));
  });

  it("fiber matches --macro-fiber", () => {
    expect(MACRO_COLORS_LIGHT.fiber).toBe(readRootVar("macro-fiber"));
  });

  it("fiber is not the same green as calories", () => {
    expect(MACRO_COLORS_LIGHT.fiber).not.toBe(MACRO_COLORS_LIGHT.calories);
    expect(readRootVar("macro-fiber")).not.toBe(readRootVar("macro-calories"));
  });

  it("sodium matches --macro-sodium", () => {
    expect(MACRO_COLORS_LIGHT.sodium).toBe(readRootVar("macro-sodium"));
  });

  it("water matches --macro-water", () => {
    expect(MACRO_COLORS_LIGHT.water).toBe(readRootVar("macro-water"));
  });

  it("sugar matches --macro-sugar (periwinkle — distinct from protein-blue)", () => {
    expect(MACRO_COLORS_LIGHT.sugar).toBe(readRootVar("macro-sugar"));
  });

  it("calories matches --macro-calories", () => {
    expect(MACRO_COLORS_LIGHT.calories).toBe(readRootVar("macro-calories"));
  });
});

describe("Settings WIDGET_MACRO_OPTIONS routes through MACRO_COLOR_VARS", () => {
  it("imports MACRO_COLOR_VARS from the canonical module", () => {
    expect(settingsSrc).toMatch(
      /import\s*\{\s*MACRO_COLOR_VARS\s*\}\s*from\s*"\.\.\/\.\.\/lib\/theme\/macroColors\.ts"/,
    );
  });

  it("never reintroduces the legacy drift hexes", () => {
    // Negative guards — the seven pre-fix hex literals must not come
    // back. Each one is uppercase-distinctive enough to be unique on
    // the surface even after future refactors.
    const drifted = ["#5B8DEF", "#F5A623", "#E05C5C", "#22c55e", "#D87FE8", "#7FB5E8", "#4FC3F7"];
    for (const hex of drifted) {
      expect(settingsSrc, `legacy macro hex ${hex} reappeared`).not.toContain(hex);
    }
  });

  it("WIDGET_MACRO_OPTIONS uses the MACRO_COLOR_VARS map for every key", () => {
    // Locate the WIDGET_MACRO_OPTIONS array literal.
    const m = settingsSrc.match(/const WIDGET_MACRO_OPTIONS = \[([\s\S]*?)\] as const;/);
    expect(m).not.toBeNull();
    const block = m![1];
    const settingsKeys = ["protein", "carbs", "fat", "fiber", "sugar", "sodium", "water"] as const;
    for (const key of settingsKeys) {
      expect(block, `key=${key}`).toContain(`MACRO_COLOR_VARS.${key}`);
    }
  });
});

describe("Today macro tiles route through MACRO_COLOR_VARS", () => {
  it("imports the canonical macro colour module", () => {
    expect(todayMacroTilesSrc).toMatch(
      /from\s+"\.\.\/\.\.\/\.\.\/lib\/theme\/macroColors"/,
    );
  });

  it("never uses --warning or bare --success for macro tile fills", () => {
    expect(todayMacroTilesSrc).not.toMatch(/fillVar:\s*"var\(--warning\)"/);
    expect(todayMacroTilesSrc).not.toMatch(/fillVar:\s*"var\(--success\)"/);
  });

  it("protein/carbs/fat/sugar tiles use MACRO_COLOR_VARS", () => {
    for (const key of ["protein", "carbs", "fat", "sugar", "fiber", "sodium", "water"] as const) {
      expect(todayMacroTilesSrc).toContain(`MACRO_COLOR_VARS.${key}`);
    }
  });
});

describe("MACRO_COLOR_VARS — CSS-var references resolve to the right tokens", () => {
  it("each var maps to a custom property declared in :root", () => {
    for (const key of Object.keys(MACRO_COLOR_VARS) as Array<keyof typeof MACRO_COLOR_VARS>) {
      const ref = MACRO_COLOR_VARS[key];
      // Extract the var name from `var(--name)`.
      const varName = ref.match(/var\(--([^)]+)\)/)?.[1];
      expect(varName, `MACRO_COLOR_VARS.${key} is not a var(--…) ref`).toBeDefined();
      expect(
        new RegExp(`--${varName}:\\s*[^;]+;`).test(ROOT_BLOCK),
        `--${varName} (referenced by MACRO_COLOR_VARS.${key}) missing in :root`,
      ).toBe(true);
    }
  });
});
