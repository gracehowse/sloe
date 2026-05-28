"use client";

/**
 * `<DigestBlended>` — the merged premium Week-Digest card (web).
 *
 * ENG-740. Blends the old dismissable `<Digest>` recap and the
 * always-on `<DigestStoryCard>` into ONE card with a single soft-filled
 * region (the closest-day hero) and everything else hairline +
 * whitespace separated. Built to
 * `docs/prototypes/2026-05-26-progress-digest-blend/index.html` and the
 * 8 principles in `docs/ux/premium-design-language.md`.
 *
 * Gated by `progress_digest_blend`; the host swaps `<Digest blended>`
 * for the legacy stacked layout. Mirror:
 * `apps/mobile/components/DigestBlended.tsx`.
 *
 * States: loading / error reuse the legacy minimal tiles (rendered by
 * `Digest` before it reaches here is NOT the path — this component owns
 * its own loading/error so the dispatcher stays dumb). empty / partial /
 * success / offline render the full card with elements suppressed when
 * their data is absent.
 */

import * as React from "react";
import { useCallback, useEffect, useRef } from "react";
import type { DigestProps } from "./digest";
import { AnalyticsEvents } from "../../../lib/analytics/events";
import { track } from "../../../lib/analytics/track";
import { Icons } from "../ui/icons";
import { cn } from "../ui/utils";
import {
  classifyDigestHeroTone,
  digestHeroTrackFraction,
} from "../../../lib/nutrition/digest";
import {
  decideWeightSurface,
  DIGEST_HIDDEN_WEIGHT_REPLACEMENT_HINT,
  DIGEST_HIDDEN_WEIGHT_REPLACEMENT_LABEL,
  formatLoggingConsistencyValue,
} from "../../../lib/nutrition/weightSurfaceMode";

export function DigestBlended(props: DigestProps) {
  const {
    weekKey,
    weekLabel,
    daysLogged,
    headline,
    stats,
    narrative,
    shareText,
    state = "success",
    offlineSyncedLabel,
    onRetry,
    onShare,
    onDismiss,
    onAdjustPace,
    weightSurfaceMode = "show",
    blendedExtras,
    className,
  } = props;

  // `weekly_recap_shown` — fire once per visible weekKey (legacy name
  // carries over; no new events per ENG-740).
  const shownRef = useRef<string | null>(null);
  useEffect(() => {
    if (state === "loading" || state === "error") return;
    if (shownRef.current === weekKey) return;
    shownRef.current = weekKey;
    track(AnalyticsEvents.weekly_recap_shown, { weekKey });
  }, [weekKey, state]);

  const handleShare = useCallback(async () => {
    track(AnalyticsEvents.weekly_recap_shared, { weekKey, platform: "web" });
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

  // ── Error state — minimal tile (parity with legacy).
  if (state === "error") {
    return (
      <section
        className={cn(
          "rounded-card border border-border bg-card p-5 mb-5 text-sm text-muted-foreground card-elevated",
          className,
        )}
        data-testid="digest"
        data-blended="true"
        data-state="error"
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
          "rounded-card border border-border bg-card p-5 mb-5 animate-pulse card-elevated",
          className,
        )}
        data-testid="digest"
        data-blended="true"
        data-state="loading"
      >
        <div className="h-[12px] w-[120px] rounded bg-muted mb-4" />
        <div className="h-[96px] w-full rounded-[14px] bg-muted/60 mb-4" />
        <div className="h-[1px] w-full bg-border mb-4" />
        <div className="grid grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-10 rounded bg-muted/50" />
          ))}
        </div>
      </section>
    );
  }

  const isEmpty = state === "empty" || daysLogged === 0;
  const isOffline = state === "offline";
  const shareDisabled = isEmpty || isOffline;
  const partialOverN = state === "partial" ? ` (over ${daysLogged} days)` : "";

  // ── HERO — closest-to-target day on a target-relative track.
  const closest = narrative.closestToTarget;
  const closestTarget = blendedExtras?.closestDayTargetCalories ?? null;
  const hasTrack = !!closest && !!closestTarget && closestTarget > 0;
  const heroTone = hasTrack
    ? classifyDigestHeroTone(closest!.calories, closestTarget!)
    : "neutral";
  const heroFraction = hasTrack
    ? digestHeroTrackFraction(closest!.calories, closestTarget!)
    : 0;
  const heroDotClass =
    heroTone === "under"
      ? "bg-success"
      : heroTone === "over"
        ? "bg-destructive"
        : "bg-muted-foreground";
  const heroNumClass =
    heroTone === "under"
      ? "text-success"
      : heroTone === "over"
        ? "text-destructive"
        : "text-foreground";

  // ── Metric strip.
  const hasWeight = stats.weightDeltaKg != null;
  const weightDecision = decideWeightSurface(weightSurfaceMode, stats.weightDeltaKg);
  const weightDeltaStr = hasWeight
    ? `${stats.weightDeltaKg! > 0 ? "+" : ""}${stats.weightDeltaKg}`
    : "—";
  const weightFirstLast =
    weightDecision.kind === "show" &&
    stats.weightFirstKg != null &&
    stats.weightLastKg != null
      ? `${stats.weightFirstKg}→${stats.weightLastKg}`
      : null;
  const proteinOnTarget =
    stats.proteinAdherencePct != null && stats.proteinAdherencePct > 0;

  // ── PATTERN row — suppress under ~4 logged days or no pattern.
  const pattern = blendedExtras?.dayOfWeekPattern ?? null;
  const showPattern = !isEmpty && daysLogged >= 4 && pattern != null;
  const patternMax = pattern
    ? Math.max(pattern.highDayAvg, pattern.lowDayAvg, 1)
    : 1;

  return (
    <section
      aria-labelledby="digest-heading"
      className={cn(
        "relative rounded-card border border-border bg-card p-5 mb-5 card-elevated",
        className,
      )}
      data-testid="digest"
      data-blended="true"
      data-state={state}
    >
      {/* Eyebrow + dismiss */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          Week digest · {weekLabel}
        </span>
        <button
          type="button"
          aria-label="Dismiss week digest"
          onClick={handleDismiss}
          className="-mr-1 -mt-1 h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground/70"
        >
          <Icons.close className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {/* HERO — the one soft-filled region */}
      <div
        className="rounded-[14px] bg-muted/40 px-4 pt-4 pb-3.5 mb-4"
        data-testid="digest-hero"
      >
        {isEmpty ? (
          <>
            <p className="text-[10.5px] font-bold uppercase tracking-[0.09em] text-muted-foreground mb-1">
              This week
            </p>
            <p className="text-[15px] font-semibold text-foreground" data-testid="digest-hero-empty">
              {headline}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              No days logged yet — log a meal to start your week.
            </p>
          </>
        ) : closest ? (
          <>
            <p className="text-[10.5px] font-bold uppercase tracking-[0.09em] text-muted-foreground mb-0.5">
              Closest to target
            </p>
            <p
              id="digest-heading"
              className="text-[24px] font-extrabold tracking-tight text-foreground mb-3.5"
              data-testid="digest-hero-day"
            >
              {closest.label}
            </p>
            {hasTrack ? (
              <>
                <div
                  className="relative h-[3px] rounded-full bg-[var(--ring-bg,rgba(0,0,0,0.08))] mx-0.5 mb-2"
                  data-testid="digest-hero-track"
                >
                  <span
                    className={cn(
                      "absolute top-1/2 h-[11px] w-[11px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card",
                      heroDotClass,
                    )}
                    style={{ left: `${(heroFraction * 100).toFixed(1)}%` }}
                    data-testid="digest-hero-dot"
                    data-tone={heroTone}
                  />
                </div>
                <div className="flex items-baseline justify-between">
                  <span
                    className={cn("text-[28px] font-extrabold leading-none tabular-nums", heroNumClass)}
                    data-testid="digest-hero-calories"
                  >
                    {Math.round(closest.calories).toLocaleString()}
                    <span className="text-[13px] font-semibold ml-0.5">kcal</span>
                  </span>
                  <span className="text-sm font-semibold text-muted-foreground tabular-nums">
                    {Math.round(closestTarget!).toLocaleString()} target
                  </span>
                </div>
                <div className="flex justify-between mt-0.5">
                  <span className="text-[10px] text-muted-foreground/70">your day</span>
                  <span className="text-[10px] text-muted-foreground/70">target</span>
                </div>
              </>
            ) : (
              // No per-day target → omit the track; show calories plainly.
              <span
                className="text-[28px] font-extrabold leading-none tabular-nums text-foreground"
                data-testid="digest-hero-calories"
              >
                {Math.round(closest.calories).toLocaleString()}
                <span className="text-[13px] font-semibold ml-0.5">kcal</span>
              </span>
            )}
            <p className="text-xs text-muted-foreground mt-2.5" data-testid="digest-hero-protein">
              {closest.protein}g protein · your most on-target day this week
            </p>
          </>
        ) : (
          // Logged days but no qualifying closest day → headline fallback.
          <>
            <p className="text-[10.5px] font-bold uppercase tracking-[0.09em] text-muted-foreground mb-0.5">
              This week
            </p>
            <p
              id="digest-heading"
              className="text-[20px] font-extrabold tracking-tight text-foreground"
              data-testid="digest-hero-day"
            >
              {headline}
            </p>
          </>
        )}
      </div>

      {/* Hairline → borderless metric strip */}
      <div className="h-px bg-border -mx-0.5" aria-hidden />
      <div className="flex py-4" data-testid="digest-stat-strip">
        <Metric label="Streak" value={isEmpty ? "—" : `${stats.streakDays}`} unit={isEmpty ? undefined : "d"} />
        <Metric
          label="Avg cal"
          value={isEmpty ? "—" : stats.avgCalories.toLocaleString()}
          sub={isEmpty ? undefined : `per day${partialOverN}`}
        />
        <Metric
          label="Protein"
          value={isEmpty ? "—" : `${stats.avgProtein}g`}
          sub={
            isEmpty
              ? undefined
              : proteinOnTarget
                ? `${stats.proteinAdherencePct}% of target`
                : "no target set"
          }
          subTone={proteinOnTarget ? "success" : "muted"}
        />
        {weightDecision.kind === "hidden" ? (
          <Metric
            label={DIGEST_HIDDEN_WEIGHT_REPLACEMENT_LABEL}
            value={isEmpty ? "—" : formatLoggingConsistencyValue(daysLogged)}
            sub={isEmpty ? undefined : DIGEST_HIDDEN_WEIGHT_REPLACEMENT_HINT}
          />
        ) : weightDecision.kind === "trends" ? (
          <Metric
            label="Weight"
            value={
              weightDecision.direction === "up"
                ? "↑"
                : weightDecision.direction === "down"
                  ? "↓"
                  : weightDecision.direction === "stable"
                    ? "→"
                    : "—"
            }
            sub={weightDecision.label}
          />
        ) : (
          <Metric
            label="Weight"
            value={hasWeight ? weightDeltaStr : "—"}
            unit={hasWeight ? "kg" : undefined}
            sub={weightFirstLast ?? (hasWeight ? undefined : "log weight any day")}
          />
        )}
      </div>

      {/* Hairline → PATTERN row */}
      {showPattern && pattern ? (
        <>
          <div className="h-px bg-border -mx-0.5" aria-hidden />
          <div className="py-4" data-testid="digest-pattern">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.09em] text-muted-foreground mb-1.5">
              Pattern
            </p>
            <p className="text-[13.5px] font-semibold text-foreground mb-2.5" data-testid="digest-pattern-summary">
              {pluralWeekday(pattern.highDay)} ran higher than {pluralWeekday(pattern.lowDay)} this week
            </p>
            <PatternBar
              label={shortDay(pattern.highDay)}
              widthPct={(pattern.highDayAvg / patternMax) * 100}
              value={`~${pattern.highDayAvg.toLocaleString()}`}
            />
            <PatternBar
              label={shortDay(pattern.lowDay)}
              widthPct={(pattern.lowDayAvg / patternMax) * 100}
              value={`~${pattern.lowDayAvg.toLocaleString()}`}
            />
            <p className="text-right text-[11px] text-muted-foreground mt-0.5 tabular-nums" data-testid="digest-pattern-delta">
              +{pattern.deltaKcal.toLocaleString()} kcal
            </p>
          </div>
        </>
      ) : null}

      {/* Hairline → maintenance row */}
      {!isEmpty && narrative.maintenanceLine ? (
        <>
          <div className="h-px bg-border -mx-0.5" aria-hidden />
          <div className="flex items-center justify-between gap-3 pt-3.5 pb-1" data-testid="digest-maintenance-line">
            <p className="text-[11.5px] leading-relaxed text-muted-foreground">
              {narrative.maintenanceLine}
            </p>
            {onAdjustPace ? (
              <button
                type="button"
                onClick={onAdjustPace}
                data-testid="digest-adjust-pace"
                className="shrink-0 text-[11.5px] font-semibold text-primary hover:text-primary/80 whitespace-nowrap"
              >
                Adjust pace →
              </button>
            ) : null}
          </div>
        </>
      ) : null}

      {/* Footer */}
      <div className="flex items-center gap-4 mt-3.5">
        <button
          type="button"
          aria-label="Share week digest"
          aria-disabled={shareDisabled || undefined}
          disabled={shareDisabled}
          onClick={handleShare}
          className={cn(
            "inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors",
            shareDisabled
              ? "bg-muted/40 text-muted-foreground opacity-40 cursor-not-allowed"
              : "bg-success-soft text-success hover:bg-success/15",
          )}
        >
          <Icons.share className="h-3.5 w-3.5" aria-hidden />
          Share week
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
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

function Metric({
  label,
  value,
  unit,
  sub,
  subTone = "muted",
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  subTone?: "muted" | "success";
}) {
  return (
    <div className="flex-1 first:pl-0 pl-3.5 text-left">
      <p className="text-[17px] font-extrabold tracking-tight tabular-nums text-foreground">
        {value}
        {unit ? <span className="text-[11px] font-medium text-muted-foreground ml-0.5">{unit}</span> : null}
      </p>
      <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground mt-1">
        {label}
      </p>
      {sub ? (
        <p
          className={cn(
            "text-[10.5px] mt-px",
            subTone === "success" ? "text-success" : "text-muted-foreground/70",
          )}
        >
          {sub}
        </p>
      ) : null}
    </div>
  );
}

function PatternBar({
  label,
  widthPct,
  value,
}: {
  label: string;
  widthPct: number;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2.5 mb-1.5">
      <span className="text-[11px] text-muted-foreground w-[30px]">{label}</span>
      <span className="flex-1 h-2 rounded-full bg-muted/60 overflow-hidden">
        <span
          className="block h-full rounded-full bg-primary/25"
          style={{ width: `${Math.min(100, Math.max(0, widthPct)).toFixed(1)}%` }}
        />
      </span>
      <span className="text-[11px] text-muted-foreground w-[46px] text-right tabular-nums">{value}</span>
    </div>
  );
}

/** "Sunday" → "Sundays" (proper-noun weekday plural). */
function pluralWeekday(label: string): string {
  if (!label) return label;
  if (label.endsWith("s")) return label;
  return `${label}s`;
}

/** "Sunday" → "Sun" for the pattern bar row labels. */
function shortDay(label: string): string {
  return label.slice(0, 3);
}

export default DigestBlended;
