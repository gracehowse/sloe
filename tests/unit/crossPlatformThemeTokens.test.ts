/**
 * Premium P0 — cross-platform Today colour parity (ENG-623).
 *
 * Pins `src/styles/theme.css` :root / .dark hex values to
 * `apps/mobile/constants/theme.ts` `Colors.light` / `Colors.dark`
 * without importing React Native into the web test runner.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const THEME_CSS = readFileSync(resolve(ROOT, "src/styles/theme.css"), "utf8");
const MOBILE_THEME = readFileSync(
  resolve(ROOT, "apps/mobile/constants/theme.ts"),
  "utf8",
);

function block(selector: ":root" | ".dark"): string {
  const needle = selector === ":root" ? ":root {" : "\n.dark {";
  const idx = THEME_CSS.indexOf(needle);
  expect(idx, `${selector} block missing in theme.css`).toBeGreaterThanOrEqual(0);
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

function readCssVar(blockSrc: string, name: string): string {
  const m = blockSrc.match(new RegExp(`--${name}:\\s*([^;]+);`));
  expect(m, `--${name} in block`).not.toBeNull();
  let value = m![1].trim().toLowerCase();
  // Resolve one hop: `--primary: var(--accent-primary)` → `#c8794e`.
  const varRef = value.match(/^var\(--([^)]+)\)$/);
  if (varRef) {
    value = readCssVar(blockSrc, varRef[1]);
  }
  return value;
}

/** Read `key: '#hex'` from `Colors.light` / `Colors.dark` object literals. */
function readMobileColor(mode: "light" | "dark", key: string): string {
  const marker = mode === "light" ? "light: {" : "dark: {";
  const start = MOBILE_THEME.indexOf(marker);
  expect(start).toBeGreaterThanOrEqual(0);
  const slice = MOBILE_THEME.slice(start, start + 2500);
  const m = slice.match(new RegExp(`${key}:\\s*'([^']+)'`));
  expect(m, `${mode}.${key}`).not.toBeNull();
  return m![1].trim().toLowerCase();
}

function readMobileAccent(key: string): string {
  const m = MOBILE_THEME.match(new RegExp(`${key}:\\s*'([^']+)'`));
  expect(m, `Accent.${key}`).not.toBeNull();
  return m![1].trim().toLowerCase();
}

/** Read a `key: '#hex'` (or `key: Accent.foo`) entry from the `MacroColors`
 *  object literal, resolving the one `Accent.*` indirection used there. */
function readMobileMacro(key: string): string {
  const start = MOBILE_THEME.indexOf("export const MacroColors = {");
  expect(start, "MacroColors literal").toBeGreaterThanOrEqual(0);
  const slice = MOBILE_THEME.slice(start, start + 900);
  const m = slice.match(new RegExp(`${key}:\\s*([^,]+),`));
  expect(m, `MacroColors.${key}`).not.toBeNull();
  let raw = m![1].trim();
  const accentRef = raw.match(/^Accent\.(\w+)$/);
  if (accentRef) return readMobileAccent(accentRef[1]);
  return raw.replace(/['"]/g, "").toLowerCase();
}

const LIGHT = block(":root");
const DARK = block(".dark");

describe("cross-platform theme tokens (ENG-623)", () => {
  describe("light mode", () => {
    it("surfaces + ink", () => {
      expect(readCssVar(LIGHT, "background")).toBe(readMobileColor("light", "background"));
      expect(readCssVar(LIGHT, "foreground")).toBe(readMobileColor("light", "text"));
      expect(readCssVar(LIGHT, "card")).toBe(readMobileColor("light", "card"));
      expect(readCssVar(LIGHT, "border")).toBe(readMobileColor("light", "border"));
      expect(readCssVar(LIGHT, "muted-foreground")).toBe(
        readMobileColor("light", "textSecondary"),
      );
    });

    it("primary + over-budget", () => {
      expect(readCssVar(LIGHT, "primary")).toBe(readMobileAccent("primary"));
      expect(readCssVar(LIGHT, "over-budget-fg")).toBe(
        readMobileColor("light", "overBudgetFg"),
      );
    });

    it("macro hues (Sloe Phase 0 — web ↔ mobile MacroColors parity)", () => {
      // Sloe: protein olive-sage, carbs clay, fat amber, calories plum.
      expect(readCssVar(LIGHT, "macro-protein")).toBe(readMobileMacro("protein"));
      expect(readCssVar(LIGHT, "macro-carbs")).toBe(readMobileMacro("carbs"));
      expect(readCssVar(LIGHT, "macro-fat")).toBe(readMobileMacro("fat"));
      expect(readCssVar(LIGHT, "macro-calories")).toBe(readMobileMacro("calories"));
    });

    it("macro hues resolve to the documented Sloe values", () => {
      expect(readCssVar(LIGHT, "macro-protein")).toBe("#7c8466"); // olive-sage
      expect(readCssVar(LIGHT, "macro-carbs")).toBe("#c8794e");   // clay
      expect(readCssVar(LIGHT, "macro-fat")).toBe("#c9892c");     // amber
      expect(readCssVar(LIGHT, "macro-calories")).toBe("#3b2a4d"); // plum
    });

    it("calorie ring empty track", () => {
      expect(readCssVar(LIGHT, "ring-bg")).toBe(readMobileColor("light", "ringTrack"));
      expect(readCssVar(LIGHT, "ring-track")).toBe(readMobileColor("light", "ringTrack"));
    });
  });

  describe("dark mode", () => {
    it("ink + border (aligned)", () => {
      expect(readCssVar(DARK, "foreground")).toBe(readMobileColor("dark", "text"));
      expect(readCssVar(DARK, "border")).toBe(readMobileColor("dark", "border"));
    });

    it("surfaces aligned (premium sprint 2026-05-20)", () => {
      expect(readCssVar(DARK, "background")).toBe(readMobileColor("dark", "background"));
      expect(readCssVar(DARK, "card")).toBe(readMobileColor("dark", "card"));
    });

    it("over-budget red (Sloe D-2) — web ↔ mobile parity", () => {
      expect(readCssVar(DARK, "over-budget-fg")).toBe(
        readMobileColor("dark", "overBudgetFg"),
      );
    });
  });

  it("Today calorie rings draw the lifted-plum overage LAP when over budget (Sloe D-1, 2026-06-04 redesign)", () => {
    // Sloe D-1 (redesigned 2026-06-04, Grace): under-budget is the plum
    // calorie-macro arc; the OVER state no longer paints a red arc. Both
    // platforms now wrap an Apple-Watch-style "overage lap" in the plum family
    // past 100% — the red arc "read as odd" (per CalorieRing.tsx), superseding
    // `overArcColor`/`overBudgetFg`. The over-budget RED rule still holds for
    // NET/text (D-2, next test). Web ↔ mobile parity: BOTH use the overage lap.
    // (Same component pins as calorieRingSolidGreenAtTarget.test.ts.)
    const mobileRing = readFileSync(
      resolve(ROOT, "apps/mobile/components/charts/CalorieRing.tsx"),
      "utf8",
    );
    const webRing = readFileSync(
      resolve(ROOT, "src/app/components/suppr/daily-ring.tsx"),
      "utf8",
    );
    // Mobile: lifted-plum overage lap, NOT the old red arc.
    expect(mobileRing).toMatch(/stroke=\{overageLapColor\}/);
    expect(mobileRing).not.toMatch(/overArcColor = palette\.overBudgetFg/);
    // Web: the `--ring-overage-lap` token carries the wrap, NOT `--destructive`.
    expect(webRing).toMatch(/var\(--ring-overage-lap\)/);
  });

  it("TodayHeroStats NET over-target uses the over-budget token (red in Sloe, D-2)", () => {
    // Sloe D-2: fat now owns amber, so the over-budget signal is RED. The
    // token NAME (`--over-budget-fg`) is unchanged — only its value moved from
    // amber to `#C0533F`. The structural wiring (NET-over → `over-budget-fg`)
    // is what we pin; the value is verified in the light/dark sections above.
    const hero = readFileSync(
      resolve(ROOT, "src/app/components/suppr/today-hero-stats.tsx"),
      "utf8",
    );
    expect(hero).toContain('valueTone === "over"');
    expect(hero).toMatch(/valueTone === "over"[\s\S]{0,120}over-budget-fg/);
  });

  it("over-budget token resolves to the Sloe destructive red (D-2), not amber", () => {
    expect(readCssVar(LIGHT, "over-budget-fg")).toBe("#c0533f");
    expect(readCssVar(DARK, "over-budget-fg")).toBe("#dc6b55");
    // It must match the destructive hue family (over = red, post-Sloe).
    expect(readCssVar(LIGHT, "over-budget-fg")).toBe(readCssVar(LIGHT, "accent-destructive"));
  });
});
