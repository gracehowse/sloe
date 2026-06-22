import { MacroColors } from "@/constants/theme";

export type MacroColorKey = keyof typeof MacroColors;

/** Canonical fill colour for a macro role — use everywhere (tiles, rings, bars).
 *  NOTE: scheme-constant (returns the single light `MacroColors` value in both
 *  themes). Under Sloe v3 protein = plum, which is near-invisible on the
 *  Nocturne dark ground — deferred: make this scheme-aware in P1 (see ENG-1223). */
export function macroColorFor(key: string): string {
  if (key in MacroColors) {
    return MacroColors[key as MacroColorKey];
  }
  return MacroColors.protein;
}

export { MacroColors };
