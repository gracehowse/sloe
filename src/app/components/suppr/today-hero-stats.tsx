"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
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
  /** Phase 4 / Top-5 #2 (2026-04-28) — count of AI-estimated meals
   *  on the active day. When > 0, an inline caption renders below
   *  the hero ("Includes N AI-estimated meals"). Replaces the
   *  standalone pill that used to float between the hero and the
   *  macro tiles. Mirror of the mobile `aiSourcedCount` prop on
   *  `TodayHero`. */
  aiSourcedCount?: number;
}

export function TodayHeroStats(props: TodayHeroStatsProps) {
  const aiCount = props.aiSourcedCount ?? 0;
  return (
    <>
      {/* Mobile-web — keep the existing TodayHeroRing experience. */}
      <div className="md:hidden">
        <TodayHeroRing {...extractRingProps(props)} />
        {aiCount > 0 ? <AiSentinelInline count={aiCount} className="-mt-2 mb-4" /> : null}
      </div>

      {/* Desktop — bare ring + 2×2 tiles, mode toggle absolutely
          positioned so it doesn't affect ring-column height. */}
      <DesktopHeroStats {...props} />
    </>
  );
}

/**
 * AiSentinelInline — small "Includes N AI-estimated meals" pill.
 * Phase 4 / Top-5 #2 (2026-04-28) folds this inline beneath the hero
 * (mobile-web + inside the desktop hero card) so the user-facing
 * signal survives without occupying its own above-meals block.
 */
function AiSentinelInline({
  count,
  className = "",
}: {
  count: number;
  className?: string;
}) {
  return (
    <div
      className={`mx-auto inline-flex items-center gap-1.5 rounded-full bg-source-ai/[0.08] px-3 py-1.5 text-[11px] font-medium text-muted-foreground ${className}`}
      role="status"
      aria-label={`Today includes ${count} AI-estimated meal${count === 1 ? "" : "s"}`}
    >
      <Sparkles className="size-3 text-source-ai" aria-hidden />
      Includes {count} AI-estimated meal{count === 1 ? "" : "s"}
    </div>
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
  aiSourcedCount,
}: TodayHeroStatsProps) {
  const net = loggedKcal - targetKcal;
  const netStr = formatNet(net);
  const aiCount = aiSourcedCount ?? 0;

  return (
    <div className="hidden md:block relative mb-4 rounded-card border border-border bg-card p-6">
      {/* Top-right floating control: REMAINING / CONSUMED display mode.
          Absolute so it doesn't affect grid alignment.
          Prototype port (2026-04-20): moved to top-2.5 right-2.5 with
          a subtle `bg-muted/50` tint and no border — mirrors mobile's
          ui-critic fix where the bordered circle was visually
          overpowering the ring. The active chip keeps a light
          foreground tint so the mode is still scannable. */}
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
        <div className="flex justify-start">
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
            valueTone={net < 0 ? "positive" : "neutral"}
          />
        </div>
      </div>
      {aiCount > 0 ? (
        <AiSentinelInline count={aiCount} className="mt-4" />
      ) : null}
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
  valueTone?: "neutral" | "positive";
}) {
  const valueColor = valueTone === "positive" ? "text-success" : "text-foreground";
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
