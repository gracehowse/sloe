/**
 * ENG-1077 — per-micronutrient plausibility clamp for food-search preview.
 *
 * Vendor rows sometimes carry absurd micro values (e.g. sodium in the tens of
 * thousands mg/100g). Drop out-of-range keys rather than showing junk numbers.
 * Macros-only rows are unchanged; this only sanitises optional micro maps.
 */

export type MicrosPer100gShape = Record<string, number>;

/** Generous per-100g ceilings — pure salt ~39g sodium/100g ≈ 15,500mg; we use 5000. */
const MICRO_CEILINGS_PER_100G: Record<string, number> = {
  sodiumMg: 5000,
  sugarG: 100,
  fiberG: 50,
  caffeineMg: 500,
  alcoholG: 100,
  potassiumMg: 5000,
  calciumMg: 3000,
  ironMg: 100,
  vitaminCMg: 2000,
  vitaminDIu: 50_000,
  cholesterolMg: 2000,
};

const DEFAULT_MICRO_CEILING = 10_000;

function microCeilingForKey(key: string): number {
  return MICRO_CEILINGS_PER_100G[key] ?? DEFAULT_MICRO_CEILING;
}

/**
 * Returns true when every populated micro value is within the per-100g ceiling.
 */
export function isPlausibleMicrosPer100g(micros: MicrosPer100gShape): boolean {
  for (const [key, raw] of Object.entries(micros)) {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) continue;
    if (n > microCeilingForKey(key)) return false;
  }
  return true;
}

/**
 * Drop absurd micro keys; keep plausible values only.
 */
export function sanitizeMicrosPer100g(micros: MicrosPer100gShape | undefined): Record<string, number> {
  if (!micros || typeof micros !== "object") return {};
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(micros)) {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) continue;
    if (n > microCeilingForKey(key)) continue;
    out[key] = n;
  }
  return out;
}

/** Sanitize micro map; return undefined when nothing plausible remains. */
export function optionalSanitizedMicrosPer100g(
  micros: MicrosPer100gShape | undefined,
): Record<string, number> | undefined {
  if (!micros) return undefined;
  const sanitized = sanitizeMicrosPer100g(micros);
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}
