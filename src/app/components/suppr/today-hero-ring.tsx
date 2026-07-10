"use client";

import * as React from "react";
import { CircleAlert, CircleCheck, Sparkles } from "lucide-react";
import type { CalorieRingDisplayMode } from "./daily-ring";
import { CalorieRingDial } from "./calorie-ring-dial";
import { LogConfirmCheck } from "./log-confirm-check";
import { TodayFreshDayLogPill } from "./today-fresh-day-log-pill";
import { MACRO_RING_TOGGLE, todayStatusChip } from "../../../lib/copy/today";
import { useCalorieRingGeometry } from "../../../lib/hooks/useCalorieRingGeometry";
import { isFeatureEnabled } from "../../../lib/analytics/track.ts";
import { SupprCard } from "../ui/suppr-card.tsx";

/**
 * TodayHeroRing — Today-screen calorie ring wrapper (mobile-web).
 * Mirrors `apps/mobile/components/today/TodayHeroRing.tsx`.
 */
export interface TodayHeroRingProps {
  consumed: number;
  target: number;
  /** Base calorie target before activity bonus (for Bonus stat). */
  baseGoal?: number;
  proteinPct: number;
  carbsPct: number;
  fatPct: number;
  expanded: boolean;
  onToggleExpanded: () => void;
  /** @deprecated 2026-06-10 (web ring parity 2026-06-10) — the
   *  Remaining/Consumed toggle is retired; ignored. Kept for call-site
   *  stability. */
  displayMode?: CalorieRingDisplayMode;
  /** @deprecated 2026-06-10 (web ring parity 2026-06-10) — ignored. */
  onToggleDisplayMode?: () => void;
  onPressWhy?: () => void;
  /** ENG-1184 — tap the status chip (Fresh start / Under / Over) to open
   *  the calorie-target explainer. Distinct from the retired "Why this
   *  number?" pill; the chip is the calm, Figma-native affordance. */
  onPressStatusChip?: () => void;
  /** ENG-1293 — always-present labelled Coach entry (sweep decision #3,
   *  2026-07-01). Renders a "Coach" chip in the hero chip row in EVERY state
   *  (over budget, all logged, past days, fasting) — the old deficit-line
   *  deep-link vanished exactly when the user needed it. Host gates on
   *  `coach_screen_v1`. Mobile-web only surface — desktop gets the sidebar
   *  "Coach" item instead (this component renders under `md:hidden`). */
  onPressCoach?: () => void;
  pulse?: boolean;
  /** ENG-1016 — per-commit ring pulse (the web analog of mobile's Medium
   *  commit haptic). True for ~160ms after an ordinary log lands. */
  commitPulse?: boolean;
  /** ENG-722 — log-confirm checkmark. True for ~480ms after an ordinary log
   *  lands; overlays a calm sage check on the ring (visual half of the commit
   *  feedback whose haptic shipped 2026-04-28). */
  logConfirmVisible?: boolean;
  /** ENG-889 — optional coach line rendered inside the hero card below stats. */
  coachLine?: React.ReactNode;
  /** ENG-1372 — true iff today has zero logged entries (host-computed, NOT
   *  `consumed === 0` — a 0-kcal logged item should still count as
   *  "logged"). Behind `empty_state_grammar_v1`: swaps the empty ring track
   *  to the warm-tint token, renders the time-aware fresh-day log pill
   *  inside the hero, and suppresses the BONUS stat cell. */
  isFreshDay?: boolean;
  /** Opens the LogSheet scoped to the time-appropriate meal slot from the
   *  fresh-day pill. Required when `isFreshDay` is true. */
  onLogFreshDaySlot?: () => void;
}

type ChipState = "empty" | "under" | "over";

function HeroStatusChip({
  state,
  onPress,
}: {
  state: ChipState;
  onPress?: () => void;
}) {
  const config =
    state === "over"
      ? {
          label: todayStatusChip("over"),
          // ENG-1453: over-budget is AMBER in every state of every branch
          // (ENG-1296 — red retired product-wide). Semantic over-budget
          // tokens alias the warning family, so pixels match the previous
          // tierV1 pill exactly.
          className: "bg-over-budget-soft text-over-budget-fg",
          Icon: CircleAlert,
        }
      : state === "empty"
        ? {
            label: todayStatusChip("empty"),
            className: "text-foreground-brand",
            Icon: Sparkles,
          }
        : {
            label: todayStatusChip("under"),
            // AA fix (2026-06-16, mirror mobile sageInk): the "Under budget"
            // cue uses the SOLID sage (#466046, 6.95:1) for text/icon — the
            // lighter success (#5E7C5A) was only ~4:1 on its own tint.
            className: "text-success-solid",
            Icon: CircleCheck,
          };
  const { label, className, Icon } = config;
  const chipClassName = `inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${className}`;
  if (!onPress) {
    return (
      <span data-testid="today-ring-status-chip" className={chipClassName}>
        <Icon size={14} strokeWidth={2} aria-hidden />
        {label}
      </span>
    );
  }
  return (
    <button
      type="button"
      data-testid="today-ring-status-chip"
      onClick={onPress}
      aria-label={`${label}, see how your calorie target was set`}
      className={`${chipClassName} cursor-pointer transition-opacity hover:opacity-90`}
    >
      <Icon size={14} strokeWidth={2} aria-hidden />
      {label}
    </button>
  );
}

/**
 * HeroCoachChip — the always-present labelled Coach entry in the hero chip
 * row (ENG-1293). Same element, same treatment as the "Coach" pill on the
 * Coach screen header (`coach-screen.tsx`): frost-mist fill, plum Sparkles +
 * label. Mobile mirror: `TodayCoachChip` in
 * `apps/mobile/components/today/TodayHeroChips.tsx`.
 */
function HeroCoachChip({ onPress }: { onPress: () => void }) {
  return (
    <button
      type="button"
      data-testid="today-coach-chip"
      onClick={onPress}
      aria-label="Open your coach"
      className="inline-flex items-center gap-1 rounded-full bg-accent-frost-mist px-2 py-0.5 text-xs font-medium text-primary-solid transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Sparkles className="h-3 w-3" aria-hidden />
      Coach
    </button>
  );
}

/**
 * RingStatusLine — the de-carded v3 hero's status indicator (ENG-1247): a
 * centered dot + label BELOW the ring (prototype `.ring-status`), replacing the
 * carded hero's chip-above-the-ring. Sage when under, over-budget AMBER when
 * over (ENG-1453 — the old over=red rule was retired by ENG-1296; mirrors
 * mobile); hidden on empty days. Copy from the shared `todayStatusChip`
 * helper (no drift). Web twin of mobile `RingStatusLine` in
 * `TodayHeroChips.tsx`.
 */
function RingStatusLine({ state }: { state: ChipState }) {
  if (state === "empty") return null;
  const colorClass = state === "over" ? "text-over-budget-fg" : "text-success-solid";
  return (
    <div
      data-testid="today-ring-status-line"
      className={`flex items-center justify-center gap-1.5 ${colorClass}`}
    >
      <span className="inline-block h-[7px] w-[7px] rounded-full bg-current" />
      <span className="text-[13px] font-semibold">{todayStatusChip(state)}</span>
    </div>
  );
}

function RingStatCell({
  label,
  value,
  labelClassName,
  valueClassName,
  divider,
}: {
  label: string;
  value: string;
  labelClassName?: string;
  valueClassName?: string;
  divider?: boolean;
}) {
  return (
    <div
      className={`flex-1 text-center px-2 ${divider ? "border-l border-border" : ""}`}
    >
      <div
        // statLabel parity (2026-06-16): 11px / 600 / wide tracking in SECONDARY
        // ink (AA), not tertiary — a calm section label, not shouty sub-AA caps.
        className={`text-[11px] font-semibold uppercase tracking-wider ${labelClassName ?? "text-foreground-secondary"}`}
      >
        {label}
      </div>
      <div
        // statValue 18→22 (2026-06-16): reads as a real stat row, not a footnote.
        // 22 = on the type ramp (--text-xl); 20 was off-scale (ENG-119 lint).
        className={`mt-1 font-[family-name:var(--font-headline)] text-[22px] font-normal tabular-nums leading-tight ${valueClassName ?? "text-foreground"}`}
      >
        {value}
      </div>
    </div>
  );
}

export function TodayHeroRing({
  consumed,
  target,
  baseGoal,
  proteinPct,
  carbsPct,
  fatPct,
  expanded,
  onToggleExpanded,
  // displayMode / onToggleDisplayMode retired (web ring parity 2026-06-10) —
  // accepted on the prop API for call-site stability, ignored here.
  onPressWhy: _onPressWhy,
  onPressStatusChip,
  onPressCoach,
  pulse = false,
  commitPulse = false,
  logConfirmVisible = false,
  coachLine,
  isFreshDay = false,
  onLogFreshDaySlot,
}: TodayHeroRingProps) {
  const isEmpty = consumed === 0 || target <= 0;
  const isOver = target > 0 && consumed > target;
  const chipState: ChipState = isEmpty ? "empty" : isOver ? "over" : "under";
  const ringGeometry = useCalorieRingGeometry();
  const bonusKcal =
    baseGoal && baseGoal < target ? Math.round(target - baseGoal) : 0;
  // ENG-1372 (empty-state grammar): only the FRESH-day case (zero logged
  // entries, host-confirmed) qualifies for the warm track / pill / BONUS
  // suppression — a merely-under-target-but-logged day keeps the standard
  // rendering.
  const emptyStateGrammarOn = isFeatureEnabled("empty_state_grammar_v1");
  const showFreshDayGrammar = emptyStateGrammarOn && isFreshDay;
  const hideBonusCell = showFreshDayGrammar && bonusKcal <= 0;

  // De-carded v3 hero (ENG-1247, flag today_hero_decard_v3, default OFF). The
  // prototype `.ring-hero` is a BARE centered block — no card chrome — with the
  // status line BELOW the ring (the 'P2' de-card this file long flagged as
  // planned). Validated on the mobile sim: the ring's scale carries the
  // separation, so the audit-gap-6 "slab" concern doesn't manifest in the v3
  // layout. Flag OFF keeps the carded hero below.
  const decard = isFeatureEnabled("today_hero_decard_v3");

  const heroInner = (
    <>
      {/* Carded hero: status CHIP above the ring. De-carded v3 hero: the chip is
          replaced by a centered RingStatusLine BELOW the ring (prototype). The
          Remaining/Consumed toggle stays retired (web ring parity 2026-06-10).
          The Coach chip (ENG-1293) takes the row's right slot in BOTH layouts
          so the entry survives every hero state. */}
      {!decard || onPressCoach ? (
        <div className="flex w-full items-center justify-between gap-2">
          {!decard ? (
            <HeroStatusChip state={chipState} onPress={onPressStatusChip} />
          ) : (
            <span aria-hidden />
          )}
          {onPressCoach ? <HeroCoachChip onPress={onPressCoach} /> : null}
        </div>
      ) : null}
      {/* ENG-722 — `relative` so the log-confirm checkmark overlays the ring
          regardless of which ring variant renders. */}
      <div className="relative flex items-center justify-center">
        <CalorieRingDial
          consumed={consumed}
          target={target}
          size={ringGeometry.size}
          numeralLarge={decard}
        />
        <LogConfirmCheck visible={logConfirmVisible} />
      </div>
      {decard ? <RingStatusLine state={chipState} /> : null}
      {/* ENG-1372 (law 2) — the fresh-day hero's ONE filled invitation, inside
          the hero (not floating beside a ghost of the data). */}
      {showFreshDayGrammar && onLogFreshDaySlot ? (
        <TodayFreshDayLogPill hour={new Date().getHours()} onPress={onLogFreshDaySlot} />
      ) : null}
      {/* Goal / Eaten / Bonus stats row — renders on EMPTY days too (web ring
          parity 2026-06-10): the empty page mirrors a populated day, so Eaten 0
          and Bonus +0 are honest numbers, not noise. Gated on `target > 0`
          (no profile target yet → no row), mirroring mobile `TodayHeroRing`.
          BONUS itself collapses when `showFreshDayGrammar` and there's no
          real bonus to show (ENG-1372 law 3 — numbers suppressed until
          earned; Goal/Eaten stay, those are honest earned zeros). */}
      {target > 0 ? (
        <div
          className={`grid w-full border-t border-border pt-2 ${hideBonusCell ? "grid-cols-2" : "grid-cols-3"}`}
          data-testid="today-ring-stats-row"
        >
          <RingStatCell
            label="Goal"
            value={Math.round(target).toLocaleString()}
          />
          <RingStatCell
            label="Eaten"
            value={Math.round(consumed).toLocaleString()}
            divider
          />
          {/* The right stat is ALWAYS Bonus (web ring parity 2026-06-10): the
              over amount reads in the ring centre + the status chip, and the
              old slot-switch hid the earned-burn number exactly when an
              over-budget user most wants to see it. 0 when no bonus — unless
              suppressed on a fresh day (ENG-1372), which also collapses the
              grid to 2 columns above so the row stays balanced. */}
          {hideBonusCell ? null : (
            <RingStatCell
              label="Bonus"
              value={bonusKcal > 0 ? `+${bonusKcal.toLocaleString()}` : "0"}
              labelClassName={bonusKcal > 0 ? "text-success" : "text-foreground-secondary"}
              valueClassName={bonusKcal > 0 ? "text-success" : "text-foreground-secondary"}
              divider
            />
          )}
        </div>
      ) : null}
      {coachLine}
      <button
        type="button"
        data-testid="today-macro-rings-toggle"
        onClick={onToggleExpanded}
        // ENG-1093 (Grace): "Hide macros" / "Show macros" share one width so the
        // centred control never wobbles between states (the two strings are equal
        // length but "Show"/"Hide" differ in glyph width). `min-w` + centred text
        // pins both labels to one footprint. Mirrors mobile `minWidth: 84`.
        className="inline-block min-w-[84px] text-center text-[11px] font-semibold text-primary-solid hover:opacity-80 transition-opacity"
      >
        {expanded ? MACRO_RING_TOGGLE.hide : MACRO_RING_TOGGLE.show}
      </button>
    </>
  );

  if (decard) {
    // Bare centered hero — no card chrome; the page provides the horizontal
    // padding so the ring + stats span the full content width (prototype).
    return (
      <div
        data-testid="today-hero-decard"
        className="flex flex-col items-center mb-3 gap-2"
      >
        {heroInner}
      </div>
    );
  }

  return (
    // Carded hero (audit gap 6, 2026-06-09): elevation="card" soft slab so the
    // near-tonal #F6F5F2-on-#FFFFFF hero separates from the page. The flag-OFF
    // path; mirrors mobile `lift="soft"` on `TodayHeroRing.tsx`.
    <SupprCard
      elevation="card"
      radius="lg"
      padding="none"
      className="flex flex-col items-center mb-3 px-4 py-3 gap-2"
    >
      {heroInner}
    </SupprCard>
  );
}
