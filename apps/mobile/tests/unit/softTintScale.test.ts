/**
 * ENG-1521 — THE sanctioned soft-tint scale (Linear ruling, 2026-07-17).
 *
 * Two steps per scheme, derived in `constants/theme.ts` and consumed ONLY as
 * named tokens:
 *   Soft       = 12% light / 18% dark
 *   SoftStrong = 20% light / 28% dark
 *
 * Pins:
 *  1. Every `*Soft` / `*SoftStrong` family token sits exactly on the scale
 *     (alpha + the family hue it derives from).
 *  2. Light softs derive from the family BASE hue; dark softs from the
 *     OLED-lifted hue (the `primarySoft`/`primarySoftDark` precedent).
 *  3. The macro + slot soft maps are total over their key sets.
 *  4. `useAccent()`'s dark resolution maps each `*Soft` onto its `*SoftDark`
 *     (spot-checked via the DARK_ACCENT wiring in `context/theme.tsx`).
 *  5. Web-parity spot pins: the success/warning/destructive softs equal the
 *     web `--accent-*-soft` values (light 12% + .dark 18%) value-for-value.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  Accent,
  Colors,
  MacroColors,
  MacroColorsDark,
  MacroColorsSoft,
  MacroColorsSoftDark,
  MacroColorsSoftStrong,
  MacroColorsSoftStrongDark,
  SlotColors,
  SlotColorsSoft,
  SlotColorsSoftDark,
  SlotColorsSoftStrong,
  SlotColorsSoftStrongDark,
} from "../../constants/theme";

/** Independent re-derivation of the theme-internal helper (hex → rgba). */
function rgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const SOFT = 0.12;
const SOFT_DARK = 0.18;
const SOFT_STRONG = 0.2;
const SOFT_STRONG_DARK = 0.28;

describe("ENG-1521 soft-tint scale — accent families", () => {
  // [lightHue, darkLiftedHue, tokenBaseName]
  const families: [string, string, string][] = [
    [Accent.success, Accent.successLight, "success"],
    [Accent.warning, Accent.warningLight, "warning"],
    [Accent.destructive, Accent.destructiveLight, "destructive"],
    [Accent.cyan, Accent.fiberLight, "cyan"],
    [Accent.info, Accent.purpleLight, "info"],
  ];

  it.each(families)("hue %s family (%#) sits exactly on the 12/18/20/28 scale", (light, lifted, name) => {
    const A = Accent as Record<string, string>;
    expect(A[`${name}Soft`]).toBe(rgba(light, SOFT));
    expect(A[`${name}SoftDark`]).toBe(rgba(lifted, SOFT_DARK));
    expect(A[`${name}SoftStrong`]).toBe(rgba(light, SOFT_STRONG));
    expect(A[`${name}SoftStrongDark`]).toBe(rgba(lifted, SOFT_STRONG_DARK));
  });

  it("win family — winSoft stays the ratified 12% damson; dark + strong steps on-scale", () => {
    expect(Accent.winSoft).toBe(rgba(Accent.win, SOFT));
    expect(Accent.winSoftDark).toBe(rgba(Accent.purpleLight, SOFT_DARK));
    expect(Accent.winSoftStrong).toBe(rgba(Accent.win, SOFT_STRONG));
    expect(Accent.winSoftStrongDark).toBe(rgba(Accent.purpleLight, SOFT_STRONG_DARK));
  });

  it("web-parity spot pins — success/warning/destructive softs equal --accent-*-soft", () => {
    // src/styles/theme.css :root + .dark (light 12% / dark 18%).
    expect(Accent.successSoft).toBe("rgba(94, 124, 90, 0.12)");
    expect(Accent.successSoftDark).toBe("rgba(131, 165, 126, 0.18)");
    expect(Accent.warningSoft).toBe("rgba(201, 137, 44, 0.12)");
    expect(Accent.warningSoftDark).toBe("rgba(214, 162, 74, 0.18)");
    expect(Accent.destructiveSoft).toBe("rgba(176, 68, 52, 0.12)");
    expect(Accent.destructiveSoftDark).toBe("rgba(220, 107, 85, 0.18)");
  });

  it("warningSoft == the over-budget soft (one amber family — ENG-1296)", () => {
    expect(Accent.warningSoft).toBe(Colors.light.overBudgetSoft);
    expect(Accent.warningSoftDark).toBe(Colors.dark.overBudgetSoft);
  });
});

describe("ENG-1521 soft-tint scale — macro + slot maps", () => {
  const macroKeys = [
    "calories", "protein", "carbs", "fat", "fiber", "sugar", "sodium", "water",
  ] as const;

  it("macro softs are total over the 8 identity hues and on-scale", () => {
    for (const k of macroKeys) {
      expect(MacroColorsSoft[k], `MacroColorsSoft.${k}`).toBe(rgba(MacroColors[k], SOFT));
      expect(MacroColorsSoftDark[k], `MacroColorsSoftDark.${k}`).toBe(
        rgba(MacroColorsDark[k], SOFT_DARK),
      );
      expect(MacroColorsSoftStrong[k]).toBe(rgba(MacroColors[k], SOFT_STRONG));
      expect(MacroColorsSoftStrongDark[k]).toBe(rgba(MacroColorsDark[k], SOFT_STRONG_DARK));
    }
  });

  it("slot softs are total over the 4 slots; dark derives from the lifted hues", () => {
    const lifted: typeof SlotColors = {
      breakfast: Accent.warningLight,
      lunch: Accent.successLight,
      dinner: Accent.purpleLight,
      snack: Accent.fiberLight,
    };
    for (const k of Object.keys(SlotColors) as (keyof typeof SlotColors)[]) {
      expect(SlotColorsSoft[k], `SlotColorsSoft.${k}`).toBe(rgba(SlotColors[k], SOFT));
      expect(SlotColorsSoftDark[k], `SlotColorsSoftDark.${k}`).toBe(rgba(lifted[k], SOFT_DARK));
      expect(SlotColorsSoftStrong[k]).toBe(rgba(SlotColors[k], SOFT_STRONG));
      expect(SlotColorsSoftStrongDark[k]).toBe(rgba(lifted[k], SOFT_STRONG_DARK));
    }
  });
});

describe("ENG-1521 soft-tint scale — useAccent() dark resolution (DARK_ACCENT wiring)", () => {
  // DARK_ACCENT is module-private in context/theme.tsx, so pin the wiring
  // textually (same pattern as the cross-platform theme-token tests).
  const CONTEXT_SRC = readFileSync(
    resolve(__dirname, "../../context/theme.tsx"),
    "utf8",
  );

  it.each([
    "success", "warning", "destructive", "cyan", "info", "win",
  ])("maps %sSoft(Strong) onto the *Dark step in dark scheme", (name) => {
    expect(CONTEXT_SRC).toMatch(
      new RegExp(`${name}Soft:\\s*Accent\\.${name}SoftDark`),
    );
    expect(CONTEXT_SRC).toMatch(
      new RegExp(`${name}SoftStrong:\\s*Accent\\.${name}SoftStrongDark`),
    );
  });
});

describe("ENG-1521 soft-tint scale — scheme-resolved theme colours", () => {
  it("provenance + confidence chip softs sit on the scale (Soft step only)", () => {
    expect(Colors.light.sourceManualSoft).toBe(rgba(Colors.light.sourceManual, SOFT));
    expect(Colors.light.sourceAiSoft).toBe(rgba(Colors.light.sourceAi, SOFT));
    expect(Colors.light.confidenceNeutralSoft).toBe(rgba(Colors.light.confidenceNeutral, SOFT));
    expect(Colors.dark.sourceManualSoft).toBe(rgba(Colors.dark.sourceManual, SOFT_DARK));
    expect(Colors.dark.sourceAiSoft).toBe(rgba(Colors.dark.sourceAi, SOFT_DARK));
    expect(Colors.dark.confidenceNeutralSoft).toBe(rgba(Colors.dark.confidenceNeutral, SOFT_DARK));
  });
});
