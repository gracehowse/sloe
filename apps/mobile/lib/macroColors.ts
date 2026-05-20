import { MacroColors } from "@/constants/theme";

export type MacroColorKey = keyof typeof MacroColors;

/** Canonical fill colour for a macro role — use everywhere (tiles, rings, bars). */
export function macroColorFor(key: string): string {
  if (key in MacroColors) {
    return MacroColors[key as MacroColorKey];
  }
  return MacroColors.protein;
}

export { MacroColors };
