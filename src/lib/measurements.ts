/**
 * Measurement-system formatting helpers.
 *
 * Single source of truth for converting kg / cm into the user-facing
 * unit (`metric` → kg/cm; `imperial` → lb/in). Lives at the repo root
 * rather than under `nutrition/` because the same formatter is used by
 * weight, height, and journey copy across both platforms.
 *
 * Action 13 Item #6 + #7 (2026-04-19) — extracted to fix imperial-unit
 * drift on mobile's Trend tile + Weight card. Before this helper,
 * mobile rendered weight deltas with " kg" suffix unconditionally even
 * for imperial users — every other weight surface respected the
 * preference, so the Progress tab was the only place an imperial user
 * saw "kg".
 *
 * Pure: no React, no I/O. Pinned by `tests/unit/measurementsFormat.test.ts`.
 */

export type MeasurementSystem = "metric" | "imperial";

const KG_TO_LB = 2.20462;

/** Round to 1 decimal place. Helper mostly to keep call-sites tidy. */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** kg → lb, rounded to 0.1. */
export function kgToLb(kg: number): number {
  return round1(kg * KG_TO_LB);
}

/** lb → kg, rounded to 0.1. */
export function lbToKg(lb: number): number {
  return round1(lb / KG_TO_LB);
}

/**
 * Format a kg value for display in the user's preferred unit. Returns
 * a string with the unit suffix attached, e.g. `"75.4 kg"` or
 * `"166.2 lb"`. The signed flag preserves negative deltas (the unit
 * conversion uses the absolute value, then the sign is re-applied).
 *
 * Returns `"—"` when the input isn't a finite number — the caller is
 * responsible for choosing whether to render that or suppress the row
 * entirely.
 */
export function formatWeightForUnit(opts: {
  kg: number | null | undefined;
  system: MeasurementSystem;
  /** When true, prefix the value with `+` for positive numbers and
   *  `−` (proper minus sign) for negative numbers. Useful for trend
   *  lines that need a delta-shaped readout. */
  signed?: boolean;
}): string {
  const { kg, system, signed } = opts;
  if (typeof kg !== "number" || !Number.isFinite(kg)) return "—";
  const abs = Math.abs(kg);
  const value = system === "imperial" ? kgToLb(abs) : round1(abs);
  const unit = system === "imperial" ? "lb" : "kg";
  if (!signed) return `${value} ${unit}`;
  const sign = kg < 0 ? "−" : kg > 0 ? "+" : "";
  return `${sign}${value} ${unit}`;
}

/** Coerce an unknown (DB column) into a `MeasurementSystem`. */
export function coerceMeasurementSystem(raw: unknown): MeasurementSystem {
  return raw === "imperial" ? "imperial" : "metric";
}
