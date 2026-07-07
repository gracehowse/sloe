/**
 * Shared multi-source micros-merge (ENG-1362 — round 2 of the ENG-550
 * FoodSearchPanel extraction).
 *
 * Both panels fetch a search hit's minimal inline micros panel (fiber /
 * sugar / sodium, from the search route) and then, on select, fetch a
 * richer per-food micros panel from a vendor detail endpoint (e.g. Edamam's
 * `/nutrients`). The richer fetch is the authoritative superset — it wins
 * on any overlapping key — but must never DROP a value the search hit
 * already carried when the detail fetch fails or returns a partial map.
 * `{}` on total fetch failure leaves the search-hit micros intact.
 *
 * This one-line merge was reimplemented identically in both
 * `FoodSearchPanel.tsx` files; extracted here + sanitised through the
 * shared plausibility clamp so both platforms apply the exact same
 * ceiling-drop rules to the merged result.
 */
import { sanitizeMicrosPer100g, type MicrosPer100gShape } from "./microPlausibility";

/**
 * Merge a richer, freshly-fetched per-100g micros map OVER a search hit's
 * existing (possibly minimal) micros map, then sanitise the merged result
 * against implausible per-100g ceilings.
 *
 * @param existingMicros micros already on the search-result row (may be undefined).
 * @param fetchedMicros micros from the on-select vendor detail fetch (may be `{}`).
 */
export function mergeFetchedMicrosPer100g(
  existingMicros: MicrosPer100gShape | undefined,
  fetchedMicros: MicrosPer100gShape | undefined,
): Record<string, number> {
  return sanitizeMicrosPer100g({ ...(existingMicros ?? {}), ...(fetchedMicros ?? {}) });
}
