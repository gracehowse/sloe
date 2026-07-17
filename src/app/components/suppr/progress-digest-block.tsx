"use client";

/**
 * ProgressDigestBlock — the legacy Week-Digest + DigestStoryCard host block,
 * extracted VERBATIM from `ProgressDashboard.tsx` (ENG-1525: the
 * `progress_hierarchy_v1` gate + props wiring had to fit inside the host's
 * pinned 2478-line only-shrink budget, and this block was the one large
 * self-contained region with zero source-grep test pins — verified against
 * `tests/` + `apps/mobile/tests/` before the move).
 *
 * Renders on the LEGACY (flag-off) branch only; the hierarchy-v1 branch
 * renders §5 "Your Week" instead. Behaviour is unchanged:
 *
 * WEEK DIGEST (D3) — replaces the legacy WeeklyRecapCard. Host computes
 * headline + flattens usual-meal insight into the shared `DigestProps`
 * shape so web + mobile cannot drift. See `docs/design/digest-primitive.md`.
 *
 * ENG-740 — when `progress_digest_blend` is on, the single block renders
 * the merged premium card (blended hero + metric strip + PATTERN row)
 * gated on always-on `digestVisible`; the legacy `<DigestStoryCard>`
 * below is suppressed. When the flag is off, the legacy recap renders on
 * the Sat→Tue window and the story card renders below it.
 */

import { useRouter } from "next/navigation";

import { Digest } from "./digest.tsx";
import { DigestStoryCard } from "./digest-story-card.tsx";
import { resolveDigestHeadline } from "../../../lib/nutrition/digest.ts";
import {
  formatMaintenanceRecapLine,
  type ResolvedMaintenance,
} from "../../../lib/nutrition/resolveMaintenance.ts";
import { buildWeeklyCheckin } from "../../../lib/nutrition/weeklyCheckin.ts";
import {
  formatRecapForShare,
  type DigestWeekView,
  type UsualMealRecapInsight,
} from "../../../lib/nutrition/weeklyRecap.ts";
import { selectMostFrequentSlotSeed } from "../../../lib/nutrition/usualMealHint.ts";
import {
  PENDING_USUAL_MEAL_SAVE_KEY,
  serializePendingUsualMealSave,
} from "../../../lib/nutrition/pendingUsualMealSave.ts";
import type { SavedMealItem } from "../../../lib/nutrition/savedMeals.ts";
import type { WeightSurfaceMode } from "../../../lib/nutrition/weightSurfaceMode.ts";
import type { LoggedMeal } from "../../../types/recipe.ts";

export interface ProgressDigestBlockProps {
  /** Host read-once `progress_digest_blend` (ENG-740). */
  digestBlendEnabled: boolean;
  /** Host `digestBlendEnabled ? digestBlendVisible : recapVisible`. */
  digestVisible: boolean;
  recap: DigestWeekView;
  usualMealInsight: UsualMealRecapInsight;
  nutritionByDay: Record<string, LoggedMeal[]>;
  recapMaintenance: ResolvedMaintenance | null;
  adaptiveTdee: number | null;
  adaptiveConfidence: string | null;
  staticTdee: number | null;
  previousWeekTdeeKcal: number | null;
  targetsCalories: number;
  targetsProtein: number;
  /** Host `digestWeekStats.proteinOnTarget` (prev-week anchored, ENG-1373). */
  digestProteinOnTarget: number;
  weightSurfaceMode: WeightSurfaceMode;
  onDismiss: () => void | Promise<void>;
}

export function ProgressDigestBlock({
  digestBlendEnabled,
  digestVisible,
  recap,
  usualMealInsight,
  nutritionByDay,
  recapMaintenance,
  adaptiveTdee,
  adaptiveConfidence,
  staticTdee,
  previousWeekTdeeKcal,
  targetsCalories,
  targetsProtein,
  digestProteinOnTarget,
  weightSurfaceMode,
  onDismiss,
}: ProgressDigestBlockProps) {
  const router = useRouter();

  return (
    <>
      {digestVisible ? (() => {
        const digestSeed = (() => {
          if (usualMealInsight?.kind !== "prompt") return null;
          const seed = selectMostFrequentSlotSeed(nutritionByDay, usualMealInsight.suggestedSlot);
          if (!seed || seed.seedItems.length < 2) return null;
          return seed;
        })();
        const digestSeedItems = digestSeed
          ? digestSeed.seedItems.map((it) => {
              const row: Omit<SavedMealItem, "id" | "position"> = {
                recipeTitle: it.recipeTitle,
                calories: it.calories,
                protein: it.protein,
                carbs: it.carbs,
                fat: it.fat,
                portionMultiplier: 1,
              };
              if (it.fiber != null) row.fiber = it.fiber;
              if (it.source) row.source = it.source;
              return row;
            })
          : undefined;
        const usualMeal: import("./digest").DigestUsualMeal | null =
          usualMealInsight?.kind === "celebration"
            ? { kind: "celebration", name: usualMealInsight.name, count: usualMealInsight.count }
            : usualMealInsight?.kind === "prompt"
              ? {
                  kind: "prompt",
                  suggestedSlot: digestSeed?.slot ?? usualMealInsight.suggestedSlot,
                  ...(usualMealInsight.repeats != null ? { repeats: usualMealInsight.repeats } : {}),
                  ...(digestSeedItems ? { seedItems: digestSeedItems } : {}),
                }
              : null;
        const closestToTarget = recap.bestDay
          ? {
              label: recap.bestDay.label,
              protein: recap.bestDay.protein,
              calories: recap.bestDay.calories,
            }
          : null;
        const maintenanceLine = formatMaintenanceRecapLine(recapMaintenance);
        const mealsLogged = Object.values(nutritionByDay).reduce(
          (total, day) => total + (Array.isArray(day) ? day.length : 0),
          0,
        );
        const headline = resolveDigestHeadline({
          weightDeltaKg: recap.weightDeltaKg,
          closestToTargetLabel: closestToTarget?.label ?? null,
          streakDays: recap.streakLength,
          daysLogged: recap.daysLogged,
        });
        const digestState: "success" | "empty" | "partial" =
          recap.daysLogged === 0 ? "empty" : recap.daysLogged < 4 ? "partial" : "success";

        // Weekly Check-in payload — MacroFactor parity (2026-04-30).
        // Inputs come from the existing recap + the prior-week TDEE
        // snapshot the host fetches alongside `daily_targets`. We pass
        // `null` weight endpoints when the recap doesn't have ≥2
        // weigh-ins (the cascade handles the missing-weight branch).
        const currentTdeeForCheckin =
          adaptiveTdee != null && adaptiveTdee > 0 &&
          (adaptiveConfidence === "medium" || adaptiveConfidence === "high")
            ? adaptiveTdee
            : staticTdee;
        const weeklyIntakeKcal = recap.avgCalories * recap.daysLogged;
        const weighInsThisWeek = recap.weightDeltaKg != null ? 2 : 0; // ≥2 → has both endpoints
        // F-129 (Grace, 2026-05-07): pass engine confidence so the
        // weeklyCheckin gate can skip the weighInsThisWeek floor when
        // the engine already trusts the long-term TDEE — mirrors the
        // F-124 carve-out on the calibrating-card.
        const engineConfidenceForCheckin: "low" | "medium" | "high" | null =
          adaptiveConfidence === "low" ||
          adaptiveConfidence === "medium" ||
          adaptiveConfidence === "high"
            ? adaptiveConfidence
            : null;
        const weeklyCheckin = currentTdeeForCheckin
          ? buildWeeklyCheckin({
              previousTdeeKcal: previousWeekTdeeKcal,
              currentTdeeKcal: currentTdeeForCheckin,
              weeklyIntakeKcal,
              dailyTargetKcal: targetsCalories,
              weightStartKg: recap.weightFirstKg,
              weightEndKg: recap.weightLastKg,
              weighInsThisWeek,
              daysLogged: recap.daysLogged,
              adaptiveTdeeConfidence: engineConfidenceForCheckin,
            })
          : null;
        // ENG-740/1373 — PATTERN row reads `recap.dayOfWeekPattern` (same anchored+gated value the legacy story card below reads). Hero track reads the closest day's per-day target.
        const blendedExtras: import("../../../lib/nutrition/digest").DigestBlendedExtras = {
          dayOfWeekPattern: recap.dayOfWeekPattern,
          closestDayTargetCalories: recap.bestDay?.targetCalories ?? null,
          patternWindowLabel: recap.patternWindowLabel,
        };
        return (
          <Digest
            blended={digestBlendEnabled}
            blendedExtras={blendedExtras}
            onAdjustPace={() => router.push("/settings#targets")}
            weekKey={recap.weekKey}
            weekLabel={recap.weekLabel}
            daysLogged={recap.daysLogged}
            mealsLogged={mealsLogged}
            headline={headline}
            stats={{
              streakDays: recap.streakLength,
              streakFreezesAvailable: recap.freezesAvailable,
              avgCalories: recap.avgCalories,
              avgProtein: recap.avgProtein,
              proteinAdherencePct: recap.proteinAdherencePct > 0 ? recap.proteinAdherencePct : null,
              weightDeltaKg: recap.weightDeltaKg,
              weightFirstKg: recap.weightFirstKg,
              weightLastKg: recap.weightLastKg,
            }}
            narrative={{ closestToTarget, maintenanceLine, usualMeal, weeklyCheckin }}
            onAdjustGoalPace={() => {
              // Web routes to existing Settings → Targets surface;
              // we don't ship a parallel modal sheet on web.
              router.push("/settings#targets");
            }}
            shareText={formatRecapForShare(recap)}
            state={digestState}
            weightSurfaceMode={weightSurfaceMode}
            // ENG-1019/1020 — history-aware empty + check-in copy. Any logged
            // day in the journal store → returning user, not a cold start
            // (same derivation as the Progress story gate above; mirror of
            // mobile `weekly-recap.tsx`).
            hasHistory={Object.keys(nutritionByDay).some(
              (k) => (nutritionByDay[k] ?? []).length > 0,
            )}
            onShare={() => { /* Digest handles share sheet + analytics */ }}
            onDismiss={onDismiss}
            onOpenSaveCombo={(slot, items) => {
              const serialized = serializePendingUsualMealSave(slot, items);
              if (serialized && typeof window !== "undefined") {
                try {
                  window.sessionStorage.setItem(PENDING_USUAL_MEAL_SAVE_KEY, serialized);
                } catch {
                  /* sessionStorage can throw in private modes — ignore. */
                }
              }
              router.replace("/home?view=today");
            }}
            onStartUsualMealSave={() => {
              router.replace("/home?view=today");
            }}
          />
        );
      })() : null}

      {/* Week digest — narrative LEAD card (customer-lens audit 2026-04-30 +
          D-2026-04-27-17). ENG-740 — suppressed when `progress_digest_blend`
          is on (blended card above absorbs this). `dayOfWeekPattern` (Lose
          It "Closer" parity slot) reads `recap.dayOfWeekPattern`, same
          anchored+gated value as above (ENG-1373). */}
      {digestBlendEnabled ? null : (
        <div className="mb-4">
          <DigestStoryCard
            weekLabel={recap.weekLabel}
            daysLogged={recap.daysLogged}
            avgCalories={recap.avgCalories}
            targetCalories={targetsCalories}
            avgProtein={recap.avgProtein}
            targetProtein={targetsProtein}
            proteinOnTargetDays={digestProteinOnTarget}
            closestToTarget={recap.bestDay
              ? {
                  label: recap.bestDay.label,
                  calories: recap.bestDay.calories,
                  protein: recap.bestDay.protein,
                }
              : null}
            dayOfWeekPattern={recap.dayOfWeekPattern}
          />
        </div>
      )}
    </>
  );
}

export default ProgressDigestBlock;
