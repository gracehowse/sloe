/**
 * ENG-1305 / ENG-1326 — Open Food Facts staleness confidence penalty.
 *
 * OFF is crowd-sourced; `last_modified_t` (Unix seconds) is the only freshness
 * signal. ENG-1305 wired the field through adapters; ENG-1326 replaces the
 * guessed 3-year binary gate with a corpus-derived linear downgrade curve.
 *
 * Corpus: `docs/testing/off-staleness-corpus-2026-07-03.json` (80 live OFF
 * search-hit samples across 30 Suppr-shaped queries — real OFF data, but 0
 * production OFF rows at analysis time (empty pre-launch tables), so this
 * reflects search-hit staleness, not actual production match frequency.
 * Re-run on real production traffic post-launch: see ENG-1340.
 * Re-run script: `npm run analyze:off-staleness-corpus`.
 *
 * Policy: confidence DOWNGRADE only — never blocks a match outright.
 */
/** P75 age from corpus — penalty begins (94 days). */
export const OFF_STALENESS_PENALTY_START_MS = 8_121_600_000;
/** max(P75 + 30d floor, P95) from corpus — full penalty reached (124 days;
 * corpus P95 was 112 days, but the P75+30d floor dominated). */
export const OFF_STALENESS_PENALTY_FULL_MS = 10_713_600_000;
/** Max confidence subtracted at/above {@link OFF_STALENESS_PENALTY_FULL_MS}. */
export const OFF_STALENESS_MAX_PENALTY = 0.08;

/** @deprecated ENG-1326 — use {@link OFF_STALENESS_PENALTY_FULL_MS}. */
export const OFF_STALE_THRESHOLD_MS = OFF_STALENESS_PENALTY_FULL_MS;

/**
 * Confidence penalty [0, {@link OFF_STALENESS_MAX_PENALTY}] from OFF age.
 * `lastModifiedT` is Unix SECONDS; `now` is epoch ms.
 */
export function offStalenessConfidencePenalty(
  lastModifiedT: number | null | undefined,
  now: number = Date.now(),
): number {
  if (typeof lastModifiedT !== "number" || !Number.isFinite(lastModifiedT) || lastModifiedT <= 0) {
    return 0;
  }
  const ageMs = now - lastModifiedT * 1000;
  if (ageMs <= OFF_STALENESS_PENALTY_START_MS) return 0;
  if (ageMs >= OFF_STALENESS_PENALTY_FULL_MS) return OFF_STALENESS_MAX_PENALTY;
  const span = OFF_STALENESS_PENALTY_FULL_MS - OFF_STALENESS_PENALTY_START_MS;
  const t = (ageMs - OFF_STALENESS_PENALTY_START_MS) / span;
  return t * OFF_STALENESS_MAX_PENALTY;
}

/** True when any staleness penalty applies (penalty &gt; 0). */
export function isOffDataStale(
  lastModifiedT: number | null | undefined,
  now: number = Date.now(),
): boolean {
  return offStalenessConfidencePenalty(lastModifiedT, now) > 0;
}
