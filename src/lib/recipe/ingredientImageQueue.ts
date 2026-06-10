/**
 * Pure decision logic for the lazy generate-on-miss endpoint
 * (`/api/ingredient-image`) — extracted so the idempotency / dedupe contract
 * is unit-testable without mocking the whole HTTP + Supabase + fal stack.
 *
 * Given the canonical keys requested and the existing `ingredient_images`
 * status per key, decide:
 *   - `candidates`   — keys to (claim +) generate this request: no row yet, OR
 *                      a `failed` row to retry. NEVER `ready`/`pending`
 *                      (ready = done; pending = another request owns it).
 *   - `alreadyReady` — keys that already have an image (nothing to do).
 *
 * Capped at `maxPerRequest` so a single recipe screen can't trigger an
 * unbounded fal spend; the rest fill in on the next visit.
 */

export type IngredientImageStatus = "ready" | "pending" | "failed";

export interface IngredientImageCandidatePlan {
  /** Keys to claim + generate (no row, or a `failed` row to retry). */
  candidates: string[];
  /** Keys already `ready` (no work). */
  alreadyReady: string[];
}

export function selectIngredientImageCandidates(
  requestedKeys: ReadonlyArray<string>,
  statusByKey: ReadonlyMap<string, IngredientImageStatus | string>,
  maxPerRequest: number,
): IngredientImageCandidatePlan {
  const seen = new Set<string>();
  const candidates: string[] = [];
  const alreadyReady: string[] = [];
  for (const key of requestedKeys) {
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const status = statusByKey.get(key);
    if (status === "ready") {
      alreadyReady.push(key);
      continue;
    }
    // no row (undefined) or a `failed` row → eligible to generate.
    // `pending` is skipped (another request claimed it).
    if (status === undefined || status === "failed") {
      candidates.push(key);
    }
  }
  return {
    candidates: candidates.slice(0, Math.max(0, maxPerRequest)),
    alreadyReady,
  };
}
