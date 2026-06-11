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
    if (!enabled || localCandidates.length < 2) return;

    let cancelled = false;
    setRefining(true);
    void (async () => {
      try {
        const res = await fetch("/api/nutrition/coach", {
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
        // Keep the local deterministic candidates on any failure.
      } finally {
        if (!cancelled) setRefining(false);
      }
    })();

    return () => {
      cancelled = true;
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
