"use client";

/**
 * WeeklyRecapCard (Batch 4.11) — Sunday-evening summary of the week
 * that just ended, with a factual, supportive voice. Mirrors the mobile
 * component in `apps/mobile/components/WeeklyRecapCard.tsx`.
 *
 * Rules:
 *   - Copy is supportive + factual. "3 days logged this week" not
 *     "You missed 4 days." No shame phrases.
 *   - Weight delta is suppressed when we don't have ≥2 weigh-ins —
 *     never show "+0.0 kg" as a faux result.
 *   - Card is dismissible. Dismiss + "Share week" both have explicit
 *     aria-labels. Card has a real `<h2>` heading so the structure is
 *     traversable by screen readers.
 *   - Share copies the shared `formatRecapForShare` string to the
 *     clipboard (web-primary; mobile uses RN Share API).
 */

import * as React from "react";
import { useCallback, useMemo } from "react";
import type {
  UsualMealRecapInsight,
  WeeklyRecap,
} from "../../../lib/nutrition/weeklyRecap";
import { formatRecapForShare } from "../../../lib/nutrition/weeklyRecap";
import {
  formatMaintenanceRecapLine,
  type ResolvedMaintenance,
} from "../../../lib/nutrition/resolveMaintenance";
import { selectMostFrequentSlotSeed } from "../../../lib/nutrition/usualMealHint";
import type { FoodHistoryMealLike } from "../../../lib/nutrition/foodHistory";
import type { SavedMealItem } from "../../../lib/nutrition/savedMeals";
import { AnalyticsEvents } from "../../../lib/analytics/events";
import { track } from "../../../lib/analytics/track";
import { Icons } from "../ui/icons";
import { cn } from "../ui/utils";

/** Loose journal-meal shape accepted by the save-prompt deep-link.
 *  Narrow enough that both `LoggedMeal` (web) and `JournalMeal` (mobile,
 *  via the shared type) fit without adapters. */
type RecapSaveSeedMeal = FoodHistoryMealLike & { name?: string | null };

export interface WeeklyRecapCardProps {
  recap: WeeklyRecap;
  onDismiss: () => void;
  className?: string;
  /** Ship M1 — usual-meal growth-loop insight. Null skips the line. */
  usualMealInsight?: UsualMealRecapInsight;
  /** Ship M1 — fallback CTA handler (route to Today) when the deep-link
   * seed isn't available. Still used by the card when `byDay` +
   * `onOpenSaveCombo` aren't supplied, or when the helper returns null. */
  onStartUsualMealSave?: (slot: "Breakfast" | "Lunch" | "Dinner" | "Snacks") => void;
  /** Post-ship #4 — journal map so the card can compute the pre-seeded
   * items for the save-prompt deep-link. When supplied alongside
   * `onOpenSaveCombo`, the CTA opens `SaveMealDialog` pre-filled with
   * the user's most-frequent items from the last 7 days in the strongest
   * slot. When the helper returns null (rare — user logged ≥5 days but
   * items don't cluster), the card falls back to `onStartUsualMealSave`. */
  byDay?: Record<string, RecapSaveSeedMeal[]>;
  /** Post-ship #4 — deep-link handler; receives the helper-picked slot
   * and the pre-seeded items. Same shape as the host's existing
   * save-combo callback, so this prop plugs straight into the web
   * `handleOpenSaveCombo` (NutritionTracker) / mobile
   * `openSaveMealSheetForSlot` wrapper. */
  onOpenSaveCombo?: (
    slot: "Breakfast" | "Lunch" | "Dinner" | "Snacks",
    seedItems: Array<Omit<SavedMealItem, "id" | "position">>,
  ) => void;
  /**
   * Action 5 Item 7 (2026-04-19) — resolved maintenance for the week.
   * When supplied AND `formatMaintenanceRecapLine` returns a non-null
   * string (adaptive branch won, confidence ≥ medium, formula known and
   * differs), the card surfaces a one-line "Your maintenance landed
   * at X kcal this week (formula said Y)." between the stat row and
   * the share button. Suppressed in every other case — the formula
   * fallback would say "landed at X (formula said X)" which isn't
   * informative.
   */
  maintenance?: ResolvedMaintenance | null;
}

export function WeeklyRecapCard({
  recap,
  onDismiss,
  className,
  usualMealInsight,
  onStartUsualMealSave,
  byDay,
  onOpenSaveCombo,
  maintenance,
}: WeeklyRecapCardProps) {
  const shareText = useMemo(() => formatRecapForShare(recap), [recap]);

  const handleShare = useCallback(async () => {
    track(AnalyticsEvents.weekly_recap_shared, {
      weekKey: recap.weekKey,
      platform: "web",
    });
    // Prefer the native share sheet when available (mobile web / PWA);
    // fall back to clipboard on desktop browsers.
    try {
      const nav = typeof navigator !== "undefined" ? navigator : null;
      if (nav && "share" in nav && typeof nav.share === "function") {
        await nav.share({
          title: "My week on Suppr",
          text: shareText,
        });
        return;
      }
      if (nav && nav.clipboard && typeof nav.clipboard.writeText === "function") {
        await nav.clipboard.writeText(shareText);
      }
    } catch {
      // Silent — user may have cancelled the share sheet, which is
      // expected on some browsers. No fallback toast needed.
    }
  }, [recap.weekKey, shareText]);

  const handleDismiss = useCallback(() => {
    track(AnalyticsEvents.weekly_recap_dismissed, { weekKey: recap.weekKey });
    onDismiss();
  }, [onDismiss, recap.weekKey]);

  /**
   * Post-ship #4 — pre-compute the save-prompt seed once per render so
   * the prompt copy (and the CTA button label) reflects the slot that
   * the dialog will actually open with. Memoised on `byDay` +
   * `suggestedSlot` so a re-render during scroll doesn't re-crunch the
   * week's journal. `null` when the caller didn't supply `byDay` or no
   * slot clusters strongly enough.
   */
  const saveSeed = useMemo(() => {
    if (!byDay) return null;
    const suggested =
      usualMealInsight?.kind === "prompt" ? usualMealInsight.suggestedSlot : null;
    return selectMostFrequentSlotSeed(byDay, suggested);
  }, [byDay, usualMealInsight]);

  /**
   * Slot label the prompt renders. When we have a deep-link seed, we
   * show the seed's slot so the copy and the opened dialog agree. When
   * the helper returns null (or `byDay` wasn't supplied), we fall back
   * to the insight's suggested slot — keeps legacy callers intact.
   */
  const promptDisplaySlot: "Breakfast" | "Lunch" | "Dinner" | "Snacks" | null =
    usualMealInsight?.kind === "prompt"
      ? saveSeed?.slot ?? usualMealInsight.suggestedSlot
      : null;

  /**
   * Post-ship #4 — handle the "Save {slot} as a meal" CTA inside the
   * prompt insight. Prefers the deep-link path (pre-seeded save dialog)
   * when `byDay` + `onOpenSaveCombo` are supplied. Falls back to the
   * route-to-Today handler when:
   *  - the helper returns null (no slot clusters strongly enough), OR
   *  - the host didn't wire the deep-link props (older callers).
   */
  const handleStartUsualMealSave = useCallback(
    (suggestedSlot: "Breakfast" | "Lunch" | "Dinner" | "Snacks") => {
      if (saveSeed && onOpenSaveCombo && saveSeed.seedItems.length >= 2) {
        const items: Array<Omit<SavedMealItem, "id" | "position">> = saveSeed.seedItems.map(
          (it) => {
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
          },
        );
        try {
          track(AnalyticsEvents.weekly_recap_save_prompt_tapped, {
            slot: saveSeed.slot,
            seedCount: items.length,
          });
        } catch {
          /* analytics is fire-and-forget */
        }
        onOpenSaveCombo(saveSeed.slot, items);
        return;
      }
      // Fallback — route to Today (legacy behaviour). No analytics event
      // fires here because the user hasn't entered the save funnel yet;
      // the slot-header save row will fire its own `saved_meal_created`
      // on completion.
      if (onStartUsualMealSave) onStartUsualMealSave(suggestedSlot);
    },
    [saveSeed, onOpenSaveCombo, onStartUsualMealSave],
  );

  const hasWeight = recap.weightDeltaKg != null;
  const weightCopy = hasWeight
    ? `${recap.weightDeltaKg! > 0 ? "+" : ""}${recap.weightDeltaKg} kg`
    : "No weigh-ins this week";
  // Action 13 Item #13 (2026-04-19) — relabel the weight headline from
  // "Change this week" (which sounds like a smoothed average) to a
  // plain "First → Last weigh-in" line that names what the user is
  // actually reading. Suppressed when we don't have both endpoints.
  const weightFirstLastLine =
    recap.weightFirstKg != null &&
    recap.weightLastKg != null &&
    recap.weightDeltaKg != null
      ? `First → Last weigh-in: ${recap.weightFirstKg} → ${recap.weightLastKg} kg (${
          recap.weightDeltaKg > 0 ? "+" : ""
        }${recap.weightDeltaKg} kg)`
      : null;

  // Action 5 Item 7 — adaptive-vs-formula one-liner. `null` when the
  // line should not render (formula fallback, low confidence, or values
  // identical). Memoised so referential equality keeps React quiet.
  const maintenanceLine = useMemo(
    () => formatMaintenanceRecapLine(maintenance),
    [maintenance],
  );

  return (
    <section
      aria-labelledby="weekly-recap-heading"
      className={cn(
        "relative rounded-card border border-border bg-card p-5 mb-5",
        "shadow-sm",
        className,
      )}
      data-testid="weekly-recap-card"
    >
      <button
        type="button"
        aria-label="Dismiss weekly recap"
        onClick={handleDismiss}
        className="absolute right-3 top-3 h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
      >
        <Icons.close className="h-4 w-4" aria-hidden />
      </button>

      <div className="flex items-center gap-2 mb-1">
        <Icons.trophy className="h-4 w-4 text-success" aria-hidden />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-success">
          Week recap
        </span>
      </div>
      <h2
        id="weekly-recap-heading"
        className="text-[18px] font-bold text-foreground mb-0.5"
      >
        Your week — {recap.weekLabel}
      </h2>
      <p className="text-xs text-muted-foreground mb-4">
        {recap.daysLogged} day{recap.daysLogged === 1 ? "" : "s"} logged
      </p>

      {/* Stat grid */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <Stat
          label="Avg calories"
          value={`${recap.avgCalories}`}
          hint="per day"
        />
        <Stat
          label="Avg protein"
          value={`${recap.avgProtein}g`}
          hint={
            recap.proteinAdherencePct > 0
              ? `${recap.proteinAdherencePct}% of target`
              : "no target set"
          }
        />
        <Stat
          label="Streak"
          value={`${recap.streakLength}`}
          hint={
            recap.freezesAvailable > 0
              ? `day${recap.streakLength === 1 ? "" : "s"} · ${recap.freezesAvailable} freeze${recap.freezesAvailable === 1 ? "" : "s"} available`
              : `day${recap.streakLength === 1 ? "" : "s"}`
          }
        />
        <Stat
          label="Weight"
          value={weightCopy}
          hint={hasWeight ? "first → last weigh-in" : "log weight any day"}
          muted={!hasWeight}
        />
      </div>

      {/* Action 13 Item #13 (2026-04-19) — explicit "First → Last
          weigh-in" line. Replaces the old "change this week" framing
          which read as a smoothed average; the underlying number was
          actually the first vs last weigh-in difference, with up to
          7 days of water/glycogen noise embedded. Naming it explicitly
          lets the user discount the noise rather than read the number
          as a multi-day average. */}
      {weightFirstLastLine ? (
        <p
          className="text-xs text-muted-foreground mb-4"
          data-testid="weekly-recap-weight-first-last"
        >
          {weightFirstLastLine}
        </p>
      ) : null}

      {recap.bestDay ? (
        /* Action 13 Item #9 (2026-04-19) — relabelled from "Best day"
           (highest protein) to "Closest to target" (smallest summed
           L1 deviation across logged macros). The function name in
           the recap type stays `bestDay` for back-compat with the
           share-string and analytics events. */
        <p
          className="text-xs text-muted-foreground mb-4"
          data-testid="weekly-recap-closest-to-target"
        >
          Closest to target — <span className="text-foreground font-semibold">{recap.bestDay.label}</span>
          {" · "}
          {recap.bestDay.protein}g protein, {recap.bestDay.calories} kcal
        </p>
      ) : null}

      {/* Ship M1 — usual meals growth-loop line. Celebration path for
          users with a re-logged saved meal; prompt path for logged-but-
          no-saved-meal-yet users. Never renders as a shame surface. */}
      {usualMealInsight?.kind === "celebration" ? (
        <p className="text-xs text-foreground mb-4" data-testid="usual-meal-recap-celebration">
          You logged{" "}
          <span className="font-semibold">{usualMealInsight.name}</span>{" "}
          {usualMealInsight.count} time{usualMealInsight.count === 1 ? "" : "s"} this
          week.
        </p>
      ) : null}
      {usualMealInsight?.kind === "prompt" && promptDisplaySlot ? (
        <div
          className="rounded-card border border-primary/25 bg-primary/5 p-3 mb-4"
          data-testid="usual-meal-recap-prompt"
        >
          <p className="text-[13px] font-semibold text-foreground">
            Got a usual {promptDisplaySlot.toLowerCase()}?
          </p>
          {/* Action 5 Item 8 (2026-04-19) — when the loosened gate
              fires, the helper passes a `repeats` count. Surface it so
              the user sees concrete evidence ("logged the same one 4
              times in 2 weeks") rather than a generic prompt. Falls
              back to the generic line for the original zero-saved-meals
              path which doesn't carry a repeat count. */}
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {usualMealInsight.repeats && usualMealInsight.repeats >= 3
              ? `You've logged the same one ${usualMealInsight.repeats} times in 2 weeks.`
              : "Save it once, log it in one tap."}
          </p>
          {onStartUsualMealSave || onOpenSaveCombo ? (
            <button
              type="button"
              onClick={() => handleStartUsualMealSave(promptDisplaySlot)}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90"
              aria-label={`Save ${promptDisplaySlot} as a usual meal`}
            >
              <Icons.save className="h-3 w-3" aria-hidden />
              Save {promptDisplaySlot} as a meal
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Action 5 Item 7 (2026-04-19) — adaptive-vs-formula one-liner.
          Suppressed unless adaptive won and differs from formula. */}
      {maintenanceLine ? (
        <p
          className="text-xs text-muted-foreground mb-4"
          data-testid="weekly-recap-maintenance-line"
        >
          {maintenanceLine}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Share weekly recap"
          onClick={handleShare}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-success-soft text-success border border-success/25 hover:bg-success/15 transition-colors"
        >
          <Icons.share className="h-3.5 w-3.5" aria-hidden />
          Share week
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-2"
        >
          Got it
        </button>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  hint,
  muted,
}: {
  label: string;
  value: string;
  hint?: string;
  muted?: boolean;
}) {
  return (
    <div className="rounded-card bg-muted/30 border border-border/60 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
        {label}
      </p>
      <p
        className={cn(
          "text-[18px] font-bold tabular-nums",
          muted ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>
      ) : null}
    </div>
  );
}
