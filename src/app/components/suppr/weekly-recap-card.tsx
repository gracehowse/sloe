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
import type { WeeklyRecap } from "../../../lib/nutrition/weeklyRecap";
import { formatRecapForShare } from "../../../lib/nutrition/weeklyRecap";
import { AnalyticsEvents } from "../../../lib/analytics/events";
import { track } from "../../../lib/analytics/track";
import { Icons } from "../ui/icons";
import { cn } from "../ui/utils";

export interface WeeklyRecapCardProps {
  recap: WeeklyRecap;
  onDismiss: () => void;
  className?: string;
}

export function WeeklyRecapCard({ recap, onDismiss, className }: WeeklyRecapCardProps) {
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

  const hasWeight = recap.weightDeltaKg != null;
  const weightCopy = hasWeight
    ? `${recap.weightDeltaKg! > 0 ? "+" : ""}${recap.weightDeltaKg} kg`
    : "No weigh-ins this week";

  return (
    <section
      aria-labelledby="weekly-recap-heading"
      className={cn(
        "relative rounded-2xl border border-border bg-card p-5 mb-5",
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
          hint={hasWeight ? "change this week" : "log weight any day"}
          muted={!hasWeight}
        />
      </div>

      {recap.bestDay ? (
        <p className="text-xs text-muted-foreground mb-4">
          Best day — <span className="text-foreground font-semibold">{recap.bestDay.label}</span>
          {" · "}
          {recap.bestDay.protein}g protein, {recap.bestDay.calories} kcal
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
    <div className="rounded-lg bg-muted/30 border border-border/60 p-3">
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
