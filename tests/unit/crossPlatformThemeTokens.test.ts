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
  const open = MOBILE_THEME.indexOf("{", start);
  let depth = 1;
  let i = open + 1;
  while (i < MOBILE_THEME.length && depth > 0) {
    const ch = MOBILE_THEME[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
    i += 1;
  }
  const slice = MOBILE_THEME.slice(open + 1, i - 1);
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

/** Read a `key: '#hex'` entry from the `MacroColorsDark` literal (ENG-1223). */
function readMobileMacroDark(key: string): string {
  const start = MOBILE_THEME.indexOf("export const MacroColorsDark");
  expect(start, "MacroColorsDark literal").toBeGreaterThanOrEqual(0);
  const slice = MOBILE_THEME.slice(start, start + 900);
  const m = slice.match(new RegExp(`${key}:\\s*([^,]+),`));
  expect(m, `MacroColorsDark.${key}`).not.toBeNull();
  return m![1].trim().replace(/['"]/g, "").toLowerCase();
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

    it("macro hues (Sloe v3 — web ↔ mobile MacroColors parity)", () => {
      // Sloe v3: protein plum, carbs amber, fat berry-rose, calories sage.
      expect(readCssVar(LIGHT, "macro-protein")).toBe(readMobileMacro("protein"));
      expect(readCssVar(LIGHT, "macro-carbs")).toBe(readMobileMacro("carbs"));
      expect(readCssVar(LIGHT, "macro-fat")).toBe(readMobileMacro("fat"));
      expect(readCssVar(LIGHT, "macro-calories")).toBe(readMobileMacro("calories"));
    });

    it("macro hues resolve to the documented Sloe v3 values", () => {
      expect(readCssVar(LIGHT, "macro-protein")).toBe("#3b2a4d"); // plum
      expect(readCssVar(LIGHT, "macro-carbs")).toBe("#c9892c");   // amber
      expect(readCssVar(LIGHT, "macro-fat")).toBe("#b25d7a");     // berry rose
      expect(readCssVar(LIGHT, "macro-calories")).toBe("#5e7c5a"); // sage
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

    it("macro hues (ENG-1223 — web .dark ↔ mobile MacroColorsDark parity)", () => {
      // Dark-scheme macros must lighten so protein (plum) doesn't vanish on the
      // Nocturne ground. Core 5 mirror web `.dark` value-for-value.
      expect(readCssVar(DARK, "macro-protein")).toBe(readMobileMacroDark("protein"));
      expect(readCssVar(DARK, "macro-carbs")).toBe(readMobileMacroDark("carbs"));
      expect(readCssVar(DARK, "macro-fat")).toBe(readMobileMacroDark("fat"));
      expect(readCssVar(DARK, "macro-calories")).toBe(readMobileMacroDark("calories"));
      expect(readCssVar(DARK, "macro-fiber")).toBe(readMobileMacroDark("fiber"));
    });
  });

  it("Today calorie rings cap at FULL when over budget — plum-always, no overage lap (web ring parity 2026-06-10)", () => {
    // web ring parity 2026-06-10 (mobile ring wave): the OVER state caps the
    // ring at one full plum lap — NO second overage lap, NO red recolour of the
    // arc. The 2026-06-04 Apple-wrap lap was retired on BOTH platforms in this
    // wave; the over verdict lives in the centre + status chip. The over-budget
    // RED rule still holds for NET/text stat tones (D-2). (Same component pins
    // as calorieRingSolidGreenAtTarget.test.ts.)
    const mobileRing = readFileSync(
      resolve(ROOT, "apps/mobile/components/charts/CalorieRing.tsx"),
      "utf8",
    );
    const webRing = readFileSync(
      resolve(ROOT, "src/app/components/suppr/daily-ring.tsx"),
      "utf8",
    );
    // Mobile: plum-always ring, no overage-lap colour, no red over-arc.
    expect(mobileRing).toMatch(/const ringStateColor = calorieRingColor/);
    expect(mobileRing).not.toMatch(/stroke=\{overageLapColor\}/);
    expect(mobileRing).not.toMatch(/overArcColor = palette\.overBudgetFg/);
    // Web: the plum `--macro-calories` arc carries every state; no overage-lap
    // token, no destructive over-recolour.
    expect(webRing).toMatch(/var\(--macro-calories\)/);
    expect(webRing).not.toMatch(/var\(--ring-overage-lap\)/);
  });

  it("StatCell over-budget red tone is retired — the right stat is always Bonus (web ring parity 2026-06-10)", () => {
    // web ring parity 2026-06-10: the Goal/Eaten/Bonus row no longer flips its
    // third cell to a red "Over" tone — the over amount reads in the ring
    // centre + status chip. The `--over-budget-fg` token still exists and is
    // used by other Today over-signals (right-rail, week sidebar); it's just no
    // longer wired into the hero stat cells.
    const hero = readFileSync(
      resolve(ROOT, "src/app/components/suppr/today-hero-stats.tsx"),
      "utf8",
    );
    expect(hero).not.toContain('valueTone === "over"');
    expect(hero).not.toContain('valueTone="over"');
  });

  it("over-budget token resolves to the Sloe destructive red (D-2), not amber", () => {
    // Light hue AA-darkened #c0533f → #b04434 (2026-06-09) so the shared
    // destructive/over-budget red clears WCAG AA 4.5:1 as text on the cream
    // `destructive/5` surface (4.86:1) — it renders as text, not just a fill.
    expect(readCssVar(LIGHT, "over-budget-fg")).toBe("#b04434");
    expect(readCssVar(DARK, "over-budget-fg")).toBe("#dc6b55");
    // It must match the destructive hue family (over = red, post-Sloe).
    expect(readCssVar(LIGHT, "over-budget-fg")).toBe(readCssVar(LIGHT, "accent-destructive"));
  });
});
