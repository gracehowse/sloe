/**
 * Calorie-ring colour rule — structural pins.
 *
 *   1. Empty (consumed === 0 / no target) → calm idle track (no solid arc).
 *   2. Logged-and-under → solid PLUM arc (`MacroColors.calories` /
 *      `--macro-calories`). The calorie ring owns the Sloe chrome/brand plum,
 *      so the total reads as the hero — NOT a green "you're under" state.
 *   3. Logged-and-over → the calorie ring STAYS PLUM (full), and a clean red
 *      overage ARC (`overBudgetFg` / `--destructive`) is drawn on top.
 *
 * MOBILE updated for the SLOE redesign (2026-06-03, `01 · Today` frame +
 * `_gen.mjs multiRing`): the over-budget treatment moved from "recolour the
 * whole ring destructive + a diagonal HASH" to "plum ring + red overage arc".
 * WEB (`daily-ring.tsx`) still carries the prior hash treatment — it is
 * reconciled to the arc in the later web-parity slot (see the dossier
 * web-parity note); its pins below are unchanged.
 *
 * Centre number + label use foreground ink; the stroke carries budget state.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MOBILE_PATH = resolve(
  __dirname,
  "../../apps/mobile/components/charts/CalorieRing.tsx",
);
const WEB_PATH = resolve(
  __dirname,
  "../../src/app/components/suppr/daily-ring.tsx",
);

const MOBILE_SRC = readFileSync(MOBILE_PATH, "utf8");
const WEB_SRC = readFileSync(WEB_PATH, "utf8");

describe("Sloe calorie ring — mobile CalorieRing", () => {
  it("under-budget arc is PLUM, NOT recoloured destructive when over (Sloe redesign)", () => {
    // The calorie ring is always plum (light or dark lift) — it is no longer
    // recoloured destructive-red when over. `ringStateColor` resolves to the
    // plum `calorieRingColor`, not `isOver ? Accent.destructive : ...`.
    expect(MOBILE_SRC).toMatch(/const ringStateColor = calorieRingColor/);
    expect(MOBILE_SRC).not.toMatch(
      /ringStateColor = isOver \? Accent\.destructive/,
    );
    expect(MOBILE_SRC).toMatch(
      /stroke=\{[\s\S]*?isEmpty[\s\S]*?\? trackColor[\s\S]*?: ringStateColor/,
    );
  });

  it("over-budget draws a clean red ARC (overBudgetFg), NOT a diagonal hash", () => {
    // The overage segment uses the over-budget red token as a solid arc.
    expect(MOBILE_SRC).toMatch(/overArcColor = palette\.overBudgetFg/);
    expect(MOBILE_SRC).toMatch(/stroke=\{overArcColor\}/);
    // The retired MFP-style diagonal hash pattern must be gone.
    expect(MOBILE_SRC).not.toMatch(/stroke="url\(#overHash\)"/);
    expect(MOBILE_SRC).not.toMatch(/id="overHash"/);
  });

  it("centre number + label use textColor (ink), not ring stroke hue", () => {
    expect(MOBILE_SRC).toMatch(/color: textColor/);
    expect(MOBILE_SRC).not.toMatch(/color: ringStateColor/);
  });

  it("does NOT use the legacy brand gradient on the Today ring stroke", () => {
    expect(MOBILE_SRC).not.toMatch(/calorie-ring-gradient/);
    expect(MOBILE_SRC).not.toMatch(/SvgLinearGradient/);
  });
});

describe("Sloe calorie ring — web DailyRing", () => {
  it("logged → over red, under PLUM calorie-macro hue (solid stroke, no gradient)", () => {
    expect(WEB_SRC).not.toContain("ring-grad-over");
    expect(WEB_SRC).not.toContain("ring-grad-success");
    // Sloe D-1: the steady under-budget stroke is --macro-calories (plum);
    // over stays --destructive. The win-spectrum celebration override above it
    // is separate (only while `celebrating`).
    expect(WEB_SRC).toMatch(
      /isOverBudget[\s\S]{0,40}\?\s*"var\(--destructive\)"[\s\S]*?:\s*"var\(--macro-calories\)"/,
    );
  });

  it("centre number + label use foreground when logged", () => {
    expect(WEB_SRC).toMatch(
      /centerValueColor = isEmpty[\s\S]*\?\s*undefined[\s\S]*?:\s*"var\(--foreground\)"/,
    );
  });

  it("does NOT use the legacy magenta brand gradient on the Today ring", () => {
    expect(WEB_SRC).not.toMatch(/daily-ring-gradient/);
    expect(WEB_SRC).not.toMatch(/#e04888/);
  });
});
