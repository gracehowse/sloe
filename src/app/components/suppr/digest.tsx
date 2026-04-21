"use client";

/**
 * Digest primitive (D3) — web.
 *
 * Replaces `weekly-recap-card.tsx`. Calmer, narrative-first "week at a
 * glance" surface on Progress. See `docs/design/digest-primitive.md`.
 *
 * Rules enforced here:
 *   - Host computes the `headline` string; Digest does NOT branch on it
 *     (§5 of brief).
 *   - `weightDeltaKg === null` suppresses the weight tile delta line —
 *     we never render "+0.0 kg" as a faux result (§8).
 *   - `maintenanceLine === null` suppresses the adaptive-vs-formula
 *     line; the host calls `formatMaintenanceRecapLine` before handing
 *     it to us (§8).
 *   - Seven states — loading / empty / partial / success / error /
 *     stale / offline — are covered per §7. Stale state is gated by
 *     the host (Digest simply does not render mid-week).
 *   - Analytics event names carry over from the legacy recap card
 *     (`weekly_recap_*`) per open-question #11; this is deliberate
 *     and flagged in `docs/design/digest-primitive.md`.
 */

import * as React from "react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { SavedMealItem } from "../../../lib/nutrition/savedMeals";
import { AnalyticsEvents } from "../../../lib/analytics/events";
import { track } from "../../../lib/analytics/track";
import { Icons } from "../ui/icons";
import { cn } from "../ui/utils";

/** Four slots the save-prompt CTA can target. */
export type DigestSlot = "Breakfast" | "Lunch" | "Dinner" | "Snacks";

/** Celebration = user re-logged a saved meal; prompt = user has a
 *  repeating unsaved meal we can nudge them to save. */
export type DigestUsualMeal =
  | {
      kind: "celebration";
      name: string;
      count: number;
    }
  | {
      kind: "prompt";
      suggestedSlot: DigestSlot;
      /** Repeats in last 2 weeks. Surfaces when ≥3. */
      repeats?: number;
      /** Optional pre-seeded items; when ≥2 the CTA deep-links to save
       *  dialog via `onOpenSaveCombo`, else falls back to Today. */
      seedItems?: Array<Omit<SavedMealItem, "id" | "position">>;
    };

export interface DigestProps {
  /** `YYYY-Www` key for the completed week. */
  weekKey: string;
  /** Human label ("14–20 Apr"). */
  weekLabel: string;
  daysLogged: number;
  mealsLogged: number;
  /** Pre-resolved headline per §5. Host computes with
   *  `resolveDigestHeadline()`; Digest renders verbatim. */
  headline: string;
  stats: {
    streakDays: number;
    streakFreezesAvailable: number;
    avgCalories: number;
    avgProtein: number;
    proteinAdherencePct: number | null;
    /** `null` → suppress weight tile delta + weigh-in line entirely. */
    weightDeltaKg: number | null;
    weightFirstKg: number | null;
    weightLastKg: number | null;
  };
  narrative: {
    closestToTarget: {
      label: string;
      protein: number;
      calories: number;
    } | null;
    /** Already-resolved string from `formatMaintenanceRecapLine`; null
     *  when adaptive == formula or confidence is low. */
    maintenanceLine: string | null;
    usualMeal: DigestUsualMeal | null;
  };
  /** Pre-formatted share string. Host computes via `formatRecapForShare`. */
  shareText: string;
  /** UI state selector (§7). Defaults to "success". */
  state?: "loading" | "empty" | "partial" | "success" | "error" | "offline";
  /** Relative "synced X ago" label — only used when state === "offline". */
  offlineSyncedLabel?: string;
  /** Error-state retry handler. */
  onRetry?: () => void;
  onShare: () => void;
  onDismiss: () => void;
  onOpenSaveCombo?: (
    slot: DigestSlot,
    seedItems: Array<Omit<SavedMealItem, "id" | "position">>,
  ) => void;
  onStartUsualMealSave?: (slot: DigestSlot) => void;
  className?: string;
}

export function Digest(props: DigestProps) {
  const {
    weekKey,
    weekLabel,
    daysLogged,
    mealsLogged,
    headline,
    stats,
    narrative,
    shareText,
    state = "success",
    offlineSyncedLabel,
    onRetry,
    onShare,
    onDismiss,
    onOpenSaveCombo,
    onStartUsualMealSave,
    className,
  } = props;

  // `weekly_digest_shown` — fire once per visible weekKey. Legacy name
  // `weekly_recap_shown` carries over (open-question #11 — flagged).
  const shownRef = useRef<string | null>(null);
  useEffect(() => {
    if (state === "loading" || state === "error") return;
    if (shownRef.current === weekKey) return;
    shownRef.current = weekKey;
    track(AnalyticsEvents.weekly_recap_shown, { weekKey });
  }, [weekKey, state]);

  const handleShare = useCallback(async () => {
    track(AnalyticsEvents.weekly_recap_shared, {
      weekKey,
      platform: "web",
    });
    onShare();
    try {
      const nav = typeof navigator !== "undefined" ? navigator : null;
      if (nav && "share" in nav && typeof nav.share === "function") {
        await nav.share({ title: "My week on Suppr", text: shareText });
        return;
      }
      if (nav?.clipboard && typeof nav.clipboard.writeText === "function") {
        await nav.clipboard.writeText(shareText);
      }
    } catch {
      /* user cancelled — expected on some browsers */
    }
  }, [weekKey, shareText, onShare]);

  const handleDismiss = useCallback(() => {
    track(AnalyticsEvents.weekly_recap_dismissed, { weekKey });
    onDismiss();
  }, [weekKey, onDismiss]);

  // ── Error state — minimal tile; never show partial numbers on error.
  if (state === "error") {
    return (
      <section
        className={cn(
          "rounded-card border border-border bg-card p-5 mb-5 text-sm text-muted-foreground",
          className,
        )}
        data-testid="digest-error"
      >
        Couldn&rsquo;t load your digest.{" "}
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="font-semibold text-foreground underline underline-offset-2"
          >
            Try again
          </button>
        ) : (
          "Try again."
        )}
      </section>
    );
  }

  // ── Loading skeleton.
  if (state === "loading") {
    return (
      <section
        aria-busy="true"
        aria-live="polite"
        className={cn(
          "rounded-card border border-border bg-card p-5 mb-5 animate-pulse",
          className,
        )}
        data-testid="digest-skeleton"
      >
        <div className="h-[14px] w-[44px] rounded bg-muted mb-3" />
        <div className="h-[20px] w-3/5 rounded bg-muted mb-2" />
        <div className="h-[12px] w-2/5 rounded bg-muted mb-4" />
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-card bg-muted/60" />
          ))}
        </div>
      </section>
    );
  }

  const isEmpty = state === "empty" || daysLogged === 0;
  const isOffline = state === "offline";
  const shareDisabled = isEmpty || isOffline;

  const hasWeight = stats.weightDeltaKg != null;
  const weightDeltaStr = hasWeight
    ? `${stats.weightDeltaKg! > 0 ? "+" : ""}${stats.weightDeltaKg} kg`
    : "—";
  const weightFirstLastLine =
    stats.weightFirstKg != null &&
    stats.weightLastKg != null &&
    stats.weightDeltaKg != null
      ? `First → Last weigh-in: ${stats.weightFirstKg} → ${stats.weightLastKg} kg (${
          stats.weightDeltaKg > 0 ? "+" : ""
        }${stats.weightDeltaKg} kg)`
      : null;

  const partialOverN = state === "partial" ? ` (over ${daysLogged} days)` : "";
  const proteinHint =
    stats.proteinAdherencePct != null && stats.proteinAdherencePct > 0
      ? `${stats.proteinAdherencePct}% of target${partialOverN}`
      : "no target set";

  const usual = narrative.usualMeal;
  const promptSlot = usual?.kind === "prompt" ? usual.suggestedSlot : null;

  const handlePromptTap = useCallback(() => {
    if (!promptSlot || usual?.kind !== "prompt") return;
    const seed = usual.seedItems ?? [];
    if (seed.length >= 2 && onOpenSaveCombo) {
      try {
        track(AnalyticsEvents.weekly_recap_save_prompt_tapped, {
          slot: promptSlot,
          seedCount: seed.length,
        });
      } catch {
        /* fire-and-forget */
      }
      onOpenSaveCombo(promptSlot, seed);
      return;
    }
    onStartUsualMealSave?.(promptSlot);
  }, [promptSlot, usual, onOpenSaveCombo, onStartUsualMealSave]);

  return (
    <section
      aria-labelledby="digest-heading"
      className={cn(
        "relative rounded-card border border-border bg-card p-5 mb-5 shadow-sm",
        className,
      )}
      data-testid="digest"
      data-state={state}
    >
      {/* Dismiss (top-right) */}
      <button
        type="button"
        aria-label="Dismiss week digest"
        onClick={handleDismiss}
        className="absolute right-3 top-3 h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
      >
        <Icons.close className="h-4 w-4" aria-hidden />
      </button>

      {/* Eyebrow */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Week digest
        </span>
        <span
          aria-hidden
          className="text-[10px] text-muted-foreground/70"
        >
          · {weekLabel}
        </span>
      </div>

      <h2
        id="digest-heading"
        className="text-[18px] font-bold text-foreground mb-0.5"
      >
        {headline}
      </h2>
      <p className="text-xs text-muted-foreground mb-4">
        {isEmpty
          ? "No days logged — that's fine."
          : `${daysLogged} day${daysLogged === 1 ? "" : "s"} logged · ${mealsLogged} meal${mealsLogged === 1 ? "" : "s"}.`}
      </p>

      {/* Stat strip — 2×2 <720px, 4-up ≥720px */}
      <div
        className="grid grid-cols-2 gap-2 mb-4 min-[720px]:grid-cols-4"
        data-testid="digest-stat-strip"
      >
        <Stat
          label="Streak"
          value={isEmpty ? "—" : `${stats.streakDays}`}
          hint={
            isEmpty
              ? "log any day to start"
              : stats.streakFreezesAvailable > 0
                ? `day${stats.streakDays === 1 ? "" : "s"} · ${stats.streakFreezesAvailable} freeze${stats.streakFreezesAvailable === 1 ? "" : "s"}`
                : `day${stats.streakDays === 1 ? "" : "s"}`
          }
          muted={isEmpty}
        />
        <Stat
          label="Avg calories"
          value={isEmpty ? "—" : `${stats.avgCalories}`}
          hint={isEmpty ? "—" : `per day${partialOverN}`}
          muted={isEmpty}
        />
        <Stat
          label="Avg protein"
          value={isEmpty ? "—" : `${stats.avgProtein}g`}
          hint={isEmpty ? "—" : proteinHint}
          muted={isEmpty}
        />
        <Stat
          label="Weight"
          value={hasWeight ? weightDeltaStr : "—"}
          hint={hasWeight ? "first → last weigh-in" : "log weight any day"}
          muted={!hasWeight}
        />
      </div>

      {/* Narrative — each line suppresses when data missing. */}
      {!isEmpty && narrative.closestToTarget ? (
        <p
          className="text-xs text-muted-foreground mb-3"
          data-testid="digest-closest-to-target"
        >
          Closest to target —{" "}
          <span className="text-foreground font-semibold">
            {narrative.closestToTarget.label}
          </span>
          {" · "}
          {narrative.closestToTarget.protein}g protein,{" "}
          {narrative.closestToTarget.calories} kcal
        </p>
      ) : null}

      {!isEmpty && weightFirstLastLine ? (
        <p
          className="text-xs text-muted-foreground mb-3"
          data-testid="digest-weight-first-last"
        >
          {weightFirstLastLine}
        </p>
      ) : null}

      {!isEmpty && narrative.maintenanceLine ? (
        <p
          className="text-xs text-muted-foreground mb-3"
          data-testid="digest-maintenance-line"
        >
          {narrative.maintenanceLine}
        </p>
      ) : null}

      {!isEmpty && usual?.kind === "celebration" ? (
        <p
          className="text-xs text-foreground mb-3"
          data-testid="digest-usual-celebration"
        >
          You logged <span className="font-semibold">{usual.name}</span>{" "}
          {usual.count} time{usual.count === 1 ? "" : "s"} this week.
        </p>
      ) : null}

      {!isEmpty && usual?.kind === "prompt" && promptSlot ? (
        <div
          className="rounded-card border border-primary/25 bg-primary/5 p-3 mb-3"
          data-testid="digest-usual-prompt"
        >
          <p className="text-[13px] font-semibold text-foreground">
            Got a usual {promptSlot.toLowerCase()}?
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {usual.repeats && usual.repeats >= 3
              ? `You've logged the same one ${usual.repeats} times in 2 weeks.`
              : "Save it once, log it in one tap."}
          </p>
          {onStartUsualMealSave || onOpenSaveCombo ? (
            <button
              type="button"
              onClick={handlePromptTap}
              aria-label={`Save ${promptSlot} as a usual meal`}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Icons.save className="h-3 w-3" aria-hidden />
              Save {promptSlot} as a meal
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Footer */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Share week digest"
          aria-disabled={shareDisabled || undefined}
          disabled={shareDisabled}
          onClick={handleShare}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors",
            shareDisabled
              ? "bg-muted/40 text-muted-foreground border-border opacity-40 cursor-not-allowed"
              : "bg-success-soft text-success border-success/25 hover:bg-success/15",
          )}
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

      {isOffline && offlineSyncedLabel ? (
        <p className="text-[11px] text-muted-foreground mt-2" data-testid="digest-offline-note">
          Showing last synced · {offlineSyncedLabel}.
        </p>
      ) : null}
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
