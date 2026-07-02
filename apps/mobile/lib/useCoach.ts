/**
 * useCoach — mobile hook that fetches the "what to eat next" coach
 * ranking (`/api/nutrition/coach`) with a LOCAL deterministic fallback
 * so the Today suggestion surface NEVER blocks on the network or AI.
 *
 * Design (mealCoach.ts): the route does the AI re-rank/phrasing over OUR
 * pre-scored candidates; this hook owns the client side:
 *   - It computes the deterministic candidate set LOCALLY first
 *     (`assembleCandidates`) so the card can render immediately from the
 *     library the screen already holds — no spinner, no empty flash.
 *   - It then asks the route to (optionally) improve the ranking +
 *     phrasing via AI, and swaps the result in when it arrives.
 *   - Any fetch failure leaves the local deterministic result in place.
 *
 * The hook returns the single best candidate in the exact shape
 * `<NorthStarBlockHost>` already consumes (so wiring is a drop-in swap of
 * the suggestion brain, not the surface). Pure data — no UI.
 *
 * Cross-platform: the web equivalent is `src/lib/today/useCoach.ts`
 * (same contract, `fetch` + `assembleCandidates`). Engine + route are
 * shared.
 */

import * as React from "react";
import {
  assembleCandidates,
  applyCoachRanking,
  type CoachCandidate,
} from "@suppr/nutrition-core/mealCoach";
import type {
  NorthStarRecipe,
  NorthStarRemaining,
  NorthStarSlot,
} from "@suppr/nutrition-core/northStarSuggestion";
import { authedFetch } from "./authedFetch";
import { getSupprApiBase } from "./supprWeb";

/**
 * ENG-1294 — client-side ceiling on the AI improvement fetch. The refine is a
 * soft, non-blocking state, so a hung request must never pin "Refining
 * order…" on screen; after this window the fetch is aborted and the
 * deterministic candidates stand. Mirrors `src/lib/today/useCoach.ts`.
 */
export const COACH_REFINE_TIMEOUT_MS = 10_000;

export interface UseCoachInput {
  library: readonly NorthStarRecipe[];
  remaining: NorthStarRemaining;
  slot?: NorthStarSlot["slot"] | null;
  /** Recipe ids skipped today (hard-excluded). */
  excludeIds?: ReadonlySet<string>;
  /** Recipe ids suggested recently (variety-penalised). */
  recentlySuggestedIds?: ReadonlySet<string>;
  /** When false, skip the AI fetch entirely and stay local-deterministic
   *  (e.g. over budget, week view, library too small — the host already
   *  gates these, but the flag keeps the hook honest). */
  enabled?: boolean;
}

export interface UseCoachResult {
  /** Ranked candidates — best first. Empty when no recipe fits. */
  candidates: CoachCandidate[];
  /** How the current ranking was produced. "deterministic" until/unless
   *  the AI fetch returns a usable ranking. */
  source: "ai" | "deterministic";
  /** True while the AI improvement fetch is in flight (the deterministic
   *  candidates are already usable — this is a soft, non-blocking state). */
  refining: boolean;
}

export function useCoach(input: UseCoachInput): UseCoachResult {
  const {
    library,
    remaining,
    slot,
    excludeIds,
    recentlySuggestedIds,
    enabled = true,
  } = input;

  // Deterministic candidate set — computed synchronously from the library
  // the screen already holds, so the card renders instantly.
  const localCandidates = React.useMemo(
    () =>
      assembleCandidates(library, remaining, {
        slot: slot ?? undefined,
        excludeIds,
        recentlySuggestedIds,
      }),
    [library, remaining, slot, excludeIds, recentlySuggestedIds],
  );

  const [aiCandidates, setAiCandidates] = React.useState<CoachCandidate[] | null>(
    null,
  );
  const [refining, setRefining] = React.useState(false);

  // Stable key so we only re-fetch when the meaningful inputs change, not
  // on every render. Candidate ids + remaining-calorie bucket capture the
  // decision space without thrashing on tiny float jitter.
  const fetchKey = React.useMemo(
    () =>
      [
        localCandidates.map((c) => c.recipeId).join(","),
        Math.round(remaining.calories),
        slot ?? "any",
      ].join("|"),
    [localCandidates, remaining.calories, slot],
  );

  React.useEffect(() => {
    // Reset any prior AI ranking when the decision space changes.
    setAiCandidates(null);

    // Nothing to refine: no fetch (the local deterministic set stands).
    // ENG-1294 — the early return must ALSO reset `refining`: when the
    // decision space shrinks below the fetch threshold mid-flight (or the
    // hook is disabled), the prior run's cleanup suppressed its own reset,
    // so without this the flag would stick true forever.
    if (!enabled || localCandidates.length < 2) {
      setRefining(false);
      return;
    }

    let cancelled = false;
    // ENG-1294 — abort + ~10s client timeout so a hung route can never pin
    // the refining state (there was previously no client-side ceiling).
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), COACH_REFINE_TIMEOUT_MS);
    setRefining(true);
    void (async () => {
      try {
        const res = await authedFetch(`${getSupprApiBase()}/api/nutrition/coach`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            remaining,
            slot: slot ?? undefined,
            excludeIds: excludeIds ? Array.from(excludeIds) : undefined,
            recentlySuggestedIds: recentlySuggestedIds
              ? Array.from(recentlySuggestedIds)
              : undefined,
          }),
        });
        if (cancelled) return;
        if (!res.ok) return; // keep local deterministic candidates
        const json = (await res.json()) as {
          ok?: boolean;
          candidates?: CoachCandidate[];
          source?: "ai" | "deterministic";
        };
        if (cancelled) return;
        // Only adopt the server ranking when it actually used AI — a
        // deterministic server answer matches the local one we already
        // show, so there's nothing to swap.
        if (json.ok && json.source === "ai" && Array.isArray(json.candidates)) {
          // Re-fold onto the LOCAL candidate set so the numbers are the
          // exact ones the screen computed, never a server round-trip
          // drift. We map server order → local candidates by id.
          const order = json.candidates.map((c) => c.recipeId);
          const reasons: Record<string, string> = {};
          for (const c of json.candidates) reasons[c.recipeId] = c.whyLine;
          const merged = applyCoachRanking(localCandidates, {
            rankedIds: order,
            reasons,
          });
          setAiCandidates(merged);
        }
      } catch {
        // Network / parse failure / timeout abort — local deterministic
        // candidates stand.
      } finally {
        clearTimeout(timeout);
        // Reset only when this run is still current — the cancelled path
        // resets synchronously in the cleanup below. Resetting here after
        // cancellation would land on a stale microtask and clear the NEXT
        // run's refining state while its fetch is still in flight.
        if (!cancelled) setRefining(false);
      }
    })();

    return () => {
      cancelled = true;
      // ENG-1294 — the cleanup owns the cancelled-path reset (synchronous,
      // ordered BEFORE the next effect run decides its own state), so
      // `refining` can never be stranded true by a cancelled run whose
      // finally was suppressed.
      controller.abort();
      clearTimeout(timeout);
      setRefining(false);
    };
    // fetchKey captures the meaningful inputs; the rest are read fresh
    // inside the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchKey, enabled]);

  const candidates = aiCandidates ?? localCandidates;
  return {
    candidates,
    source: aiCandidates ? "ai" : "deterministic",
    refining,
  };
}

export default useCoach;
