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
  // Resolve one hop: `--primary: var(--accent-primary)` → `#588ce4`.
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

    it("macro hues", () => {
      expect(readCssVar(LIGHT, "macro-protein")).toBe(readMobileAccent("primary"));
      expect(readCssVar(LIGHT, "macro-carbs")).toBe(readMobileAccent("carbs"));
      expect(readCssVar(LIGHT, "macro-fat")).toBe(readMobileAccent("magenta"));
      expect(readCssVar(LIGHT, "macro-calories")).toBe(readMobileAccent("success"));
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

    it("over-budget amber", () => {
      expect(readCssVar(DARK, "over-budget-fg")).toBe(
        readMobileColor("dark", "overBudgetFg"),
      );
    });
  });

  it("Today calorie rings use destructive red when over budget (TF49)", () => {
    const ringSrc = [
      readFileSync(resolve(ROOT, "src/app/components/suppr/daily-ring.tsx"), "utf8"),
      readFileSync(resolve(ROOT, "apps/mobile/components/charts/CalorieRing.tsx"), "utf8"),
    ].join("\n");
    expect(ringSrc).toMatch(/isOver.*Accent\.destructive/);
    expect(ringSrc).toMatch(/isOverBudget[\s\S]{0,120}--destructive/);
  });

  it("TodayHeroStats NET over-target uses over-budget amber (not red)", () => {
    // 2026-05-21: see above note. NET that's over goal renders amber.
    const hero = readFileSync(
      resolve(ROOT, "src/app/components/suppr/today-hero-stats.tsx"),
      "utf8",
    );
    expect(hero).toContain('valueTone === "over"');
    expect(hero).toMatch(/valueTone === "over"[\s\S]{0,120}over-budget-fg/);
  });
});
