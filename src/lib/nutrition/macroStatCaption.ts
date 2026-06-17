/**
 * Shared macro-stat caption + progress helpers (ENG-1014).
 *
 * Canonical copy for Today tiles, compact pills, and web/mobile twins.
 * Pinned by `tests/unit/macroStatCaption.test.ts`.
 */

export type MacroStatCaptionTone = "under" | "over" | "reference" | "none";

export interface MacroStatCaptionInput {
  current: number;
  target: number;
  unit: string;
  /** Sugar/sodium-style refs — muted "ref N unit", no remaining/over. */
  referenceOnly?: boolean;
  /** When false, over-target keeps `under` tone (fibre/water wins). */
  overIsFlag?: boolean;
}

export interface MacroStatCaptionResult {
  text: string;
  tone: MacroStatCaptionTone;
}

/** Progress fill ratio 0–1 for bar backgrounds. */
export function macroStatProgressRatio(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(1, Math.max(0, current / target));
}

export function macroStatCaption(input: MacroStatCaptionInput): MacroStatCaptionResult {
  const {
    current,
    target,
    unit,
    referenceOnly = false,
    overIsFlag = true,
  } = input;

  if (referenceOnly) {
    const unitSuffix = unit === "g" ? "g" : ` ${unit}`;
    return { text: `ref ${target}${unitSuffix}`, tone: "reference" };
  }

  if (current <= 0 && target > 0) {
    const unitSuffix = unit === "g" ? "g" : ` ${unit}`;
    return {
      text: `${Math.round(target)}${unitSuffix} remaining`,
      tone: "under",
    };
  }

  if (target <= 0) {
    return { text: "", tone: "none" };
  }

  const remain = target - current;
  const magnitude = Math.round(Math.abs(remain));
  const unitSuffix = unit === "g" ? "g" : ` ${unit}`;

  if (remain >= 0) {
    return {
      text: `${magnitude}${unitSuffix} remaining`,
      tone: "under",
    };
  }

  return {
    text: `${magnitude}${unitSuffix} over`,
    tone: overIsFlag ? "over" : "under",
  };
}
