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
} from "@suppr/shared/nutrition/mealCoach";
import type {
  NorthStarRecipe,
  NorthStarRemaining,
  NorthStarSlot,
} from "@suppr/shared/nutrition/northStarSuggestion";
import { authedFetch } from "./authedFetch";
import { getSupprApiBase } from "./supprWeb";

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
    if (!enabled || localCandidates.length < 2) return;

    let cancelled = false;
    setRefining(true);
    void (async () => {
      try {
        const res = await authedFetch(`${getSupprApiBase()}/api/nutrition/coach`, {
          method: "POST",
          headers: { "content-type": "application/json" },
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
        // Network / parse failure — local deterministic candidates stand.
      } finally {
        if (!cancelled) setRefining(false);
      }
    })();

    return () => {
      cancelled = true;
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
