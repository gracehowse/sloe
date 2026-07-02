"use client";

/**
 * useCoach — web hook that fetches the "what to eat next" coach ranking
 * (`/api/nutrition/coach`) with a LOCAL deterministic fallback so the
 * Today suggestion surface NEVER blocks on the network or AI.
 *
 * Mirror of `apps/mobile/lib/useCoach.ts` — same contract, same fold-onto-
 * local-candidates guarantee. The engine (`mealCoach.ts`) + route are
 * shared; only the auth transport differs (web uses same-origin cookie
 * auth, mobile uses a bearer token via `authedFetch`).
 *
 * The deterministic candidate set is computed synchronously from the
 * library the screen already holds, so the card renders instantly; the
 * AI improvement swaps in when (and only when) the route returns a usable
 * AI ranking.
 */

import { useEffect, useMemo, useState } from "react";
import {
  assembleCandidates,
  applyCoachRanking,
  type CoachCandidate,
} from "../nutrition/mealCoach";
import type {
  NorthStarRecipe,
  NorthStarRemaining,
  NorthStarSlot,
} from "../nutrition/northStarSuggestion";

/**
 * ENG-1294 — client-side ceiling on the AI improvement fetch. The refine is a
 * soft, non-blocking state, so a hung request must never pin "Refining
 * order…" on screen; after this window the fetch is aborted and the
 * deterministic candidates stand. Mirrors `apps/mobile/lib/useCoach.ts`.
 */
export const COACH_REFINE_TIMEOUT_MS = 10_000;

export interface UseCoachInput {
  library: readonly NorthStarRecipe[];
  remaining: NorthStarRemaining;
  slot?: NorthStarSlot["slot"] | null;
  excludeIds?: ReadonlySet<string>;
  recentlySuggestedIds?: ReadonlySet<string>;
  enabled?: boolean;
}

export interface UseCoachResult {
  candidates: CoachCandidate[];
  source: "ai" | "deterministic";
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

  const localCandidates = useMemo(
    () =>
      assembleCandidates(library, remaining, {
        slot: slot ?? undefined,
        excludeIds,
        recentlySuggestedIds,
      }),
    [library, remaining, slot, excludeIds, recentlySuggestedIds],
  );

  const [aiCandidates, setAiCandidates] = useState<CoachCandidate[] | null>(null);
  const [refining, setRefining] = useState(false);

  const fetchKey = useMemo(
    () =>
      [
        localCandidates.map((c) => c.recipeId).join(","),
        Math.round(remaining.calories),
        slot ?? "any",
      ].join("|"),
    [localCandidates, remaining.calories, slot],
  );

  useEffect(() => {
    setAiCandidates(null);
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
        const res = await fetch("/api/nutrition/coach", {
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
        if (cancelled || !res.ok) return;
        const json = (await res.json()) as {
          ok?: boolean;
          candidates?: CoachCandidate[];
          source?: "ai" | "deterministic";
        };
        if (cancelled) return;
        if (json.ok && json.source === "ai" && Array.isArray(json.candidates)) {
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
        // Keep the local deterministic candidates on any failure (network,
        // parse, timeout abort).
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchKey, enabled]);

  const candidates = aiCandidates ?? localCandidates;
  return {
    candidates,
    source: aiCandidates ? "ai" : "deterministic",
    refining,
  };
}
