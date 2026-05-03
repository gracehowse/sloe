"use client";

import * as React from "react";
import { HelpCircle } from "lucide-react";
import { DailyRing } from "./daily-ring";
import { TodayHeroRing, type TodayHeroRingProps } from "./today-hero-ring";
import { TODAY_STAT_LABELS } from "../../../lib/copy/today";

/**
 * TodayHeroStats — Today-screen hero block with the calorie ring + 4
 * stat tiles (Logged / Target / Burned / Net).
 *
 * The component renders **two distinct layouts** so each viewport feels
 * native. Both consume the same canonical copy from
 * `src/lib/copy/today.ts`.
 *
 * - **Mobile-web (`< md` / 768px)** — wraps the existing `TodayHeroRing`
 *   (centred ring, helper text, REMAINING / CONSUMED toggle stacked
 *   below). Mirrors the native mobile app so a phone-web visitor sees
 *   the same affordances they get on iOS.
 *
 * - **Desktop (`>= md` / 768px)** — clean two-column grid: bare ring on
 *   the left (no helper text, no stacked toggle), 2×2 stat tiles on the
 *   right. The display-mode toggle and the macros-expanded hint are
 *   pushed to the **top-right of the card** so they no longer offset
 *   the ring column height — that was the source of the alignment
 *   wobble flagged on 2026-04-18. Matches the landing web-shot mock
 *   (`app/(landing)/LandingPage.tsx` Web Shot).
 *
 * Do not hard-code "LOGGED" / "NET" etc. inside this component —
 * import the labels from the canonical copy module so web, mobile, and
 * landing cannot drift.
 */

export interface TodayHeroStatsProps extends TodayHeroRingProps {
  /** kcal logged today. Same source as ring's `consumed`. */
  loggedKcal: number;
  /** Effective daily calorie target (base + activity adjustment where
   *  enabled). Same source as ring's `target`. */
  targetKcal: number;
  /** Total burn = basal + active, from Apple Health where synced. 0
   *  when Health is not connected. */
  burnedKcal: number;
  /** Retained for backward compatibility with callers that still pass
   *  this prop. The value is no longer rendered — see Phase 5
   *  (2026-04-30 audit, mobile commit `3ff4f99`): the daily AI
   *  sentinel was removed in favour of a one-time first-log tooltip,
   *  per the macro-tracker-first strategic direction
   *  (2026-04-27). New web callers should not pass this prop. */
  aiSourcedCount?: number;
}

export function TodayHeroStats(props: TodayHeroStatsProps) {
  return (
    <>
      {/* Mobile-web — keep the existing TodayHeroRing experience. */}
      <div className="md:hidden">
        <TodayHeroRing {...extractRingProps(props)} />
      </div>

      {/* Desktop — bare ring + 2×2 tiles, mode toggle absolutely
          positioned so it doesn't affect ring-column height. */}
      <DesktopHeroStats {...props} />
    </>
  );
}

function extractRingProps(props: TodayHeroStatsProps): TodayHeroRingProps {
  const {
    consumed,
    target,
    proteinPct,
    carbsPct,
    fatPct,
    expanded,
    onToggleExpanded,
    displayMode,
    onDisplayModeChange,
    onPressWhy,
  } = props;
  return {
    consumed,
    target,
    proteinPct,
    carbsPct,
    fatPct,
    expanded,
    onToggleExpanded,
    displayMode,
    onDisplayModeChange,
    onPressWhy,
  };
}

function DesktopHeroStats({
  loggedKcal,
  targetKcal,
  burnedKcal,
  consumed,
  target,
  proteinPct,
  carbsPct,
  fatPct,
  expanded,
  onToggleExpanded,
  displayMode,
  onDisplayModeChange,
  onPressWhy,
}: TodayHeroStatsProps) {
  const net = loggedKcal - targetKcal;
  const netStr = formatNet(net);

  return (
    <div className="hidden md:block relative mb-4 rounded-card border border-border bg-card p-6">
      {/* Top-right floating control: REMAINING / CONSUMED display mode.
          Absolute so it doesn't affect grid alignment.
          Prototype port (2026-04-20): moved to top-2.5 right-2.5 with
          a subtle `bg-muted/50` tint and no border — mirrors mobile's
          ui-critic fix where the bordered circle was visually
          overpowering the ring. The active chip keeps a light
          foreground tint so the mode is still scannable.
          Intentional desktop-vs-mobile divergence (2026-05-02 revert
          of #50): mobile + mobile-web removed the chip control
          because the ring's long-press already covers the toggle and
          the chip felt redundant. Desktop is mouse-driven with no
          long-press equivalent, so the chip stays as the canonical
          mode switch on viewports >= md. See
          `docs/decisions/2026-05-02-revert-today-ui-changes.md`. */}
      <div
        className="absolute top-2.5 right-2.5 inline-flex rounded-md bg-muted/50 p-0.5"
        role="group"
        aria-label="Calorie ring display"
      >
        {(["remaining", "consumed"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onDisplayModeChange(mode)}
            aria-pressed={displayMode === mode}
            className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide transition-colors ${
              displayMode === mode
                ? "bg-card text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {mode}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-[auto_1fr] gap-10 items-center pr-32">
        <div className="flex flex-col items-start gap-2">
          <DailyRing
            consumed={consumed}
            target={target}
            size={160}
            strokeWidth={10}
            proteinPct={proteinPct}
            carbsPct={carbsPct}
            fatPct={fatPct}
            expanded={expanded}
            onToggle={onToggleExpanded}
            displayMode={displayMode}
          />
          {/* Audit gap #10 transparency moat (2026-05-01) — desktop "Why
              this number?" pill aligned under the ring. Mobile-web
              variant ships inside TodayHeroRing already. */}
          {onPressWhy ? (
            <button
              type="button"
              data-testid="today-hero-why-this-number-desktop"
              aria-label="Why this number? Open calorie target explanation"
              onClick={onPressWhy}
              className="inline-flex items-center gap-1 rounded-full bg-primary/15 hover:bg-primary/25 transition-colors px-3 py-1 text-[11px] font-bold tracking-wide text-primary self-center"
            >
              <HelpCircle size={12} strokeWidth={2.25} />
              Why this number?
            </button>
          ) : null}
        </div>
        {/* Sub-labels under each value (e.g. "Mifflin-St Jeor",
            "Apple Health", "deficit") were removed 2026-04-18 — the
            tile labels + Net's sign + colour are enough at a glance,
            and the source / formula are explained in their own
            surfaces (Settings, Activity Bonus card, etc.). */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-5">
          <StatTile label={TODAY_STAT_LABELS.logged} value={loggedKcal.toLocaleString()} />
          <StatTile label={TODAY_STAT_LABELS.target} value={targetKcal.toLocaleString()} />
          <StatTile
            label={TODAY_STAT_LABELS.burned}
            value={burnedKcal > 0 ? burnedKcal.toLocaleString() : "—"}
          />
          <StatTile
            label={TODAY_STAT_LABELS.net}
            value={netStr}
            // N4 (2026-05-03): three-way tone instead of two.
            //   - loggedKcal === 0 → neutral grey: nothing logged means
            //     nothing earned. Previously rendered "−1,132" in green
            //     because `net = 0 − 1132 < 0`, which read as "good
            //     deficit" when the user had simply not logged yet.
            //   - net < 0 with food logged → success green: real deficit.
            //   - net > 0 → over (amber/warning): over the target. The
            //     prototype-carryover rule (memory: project_prototype_
            //     carryover_rules) sets over-budget = amber across the
            //     app; previously this tile rendered over as plain
            //     foreground colour, which understated the signal.
            valueTone={
              loggedKcal === 0
                ? "neutral"
                : net < 0
                  ? "positive"
                  : net > 0
                    ? "over"
                    : "neutral"
            }
          />
        </div>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  valueTone = "neutral",
}: {
  label: string;
  value: string;
  valueTone?: "neutral" | "positive" | "over";
}) {
  const valueColor =
    valueTone === "positive"
      ? "text-success"
      : valueTone === "over"
        ? "text-warning"
        : "text-foreground";
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-1 text-2xl font-bold tabular-nums tracking-tight ${valueColor}`}
      >
        {value}
      </div>
    </div>
  );
}

/** Format a signed kcal value with a Unicode minus (U+2212) for
 *  negatives so the dash doesn't wrap at a line break and so
 *  screen-readers pronounce it as "minus". Zero renders as `0`. */
function formatNet(net: number): string {
  if (net === 0) return "0";
  if (net < 0) return `\u2212${Math.abs(net).toLocaleString()}`;
  return `+${net.toLocaleString()}`;
}
