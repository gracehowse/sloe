"use client";

import * as React from "react";
import type { CalorieRingDisplayMode } from "./daily-ring";
import { CalorieRingDial } from "./calorie-ring-dial";
import { LogConfirmCheck } from "./log-confirm-check";
import { TodayFreshDayLogPill } from "./today-fresh-day-log-pill";
import { MACRO_RING_TOGGLE, RING_VIEW_TOGGLE } from "../../../lib/copy/today";
import { useCalorieRingGeometry } from "../../../lib/hooks/useCalorieRingGeometry";
import { isFeatureEnabled } from "../../../lib/analytics/track.ts";
import { SupprCard } from "../ui/suppr-card.tsx";
import {
  HeroCoachChip,
  HeroStatusChip,
  RingStatCell,
  RingStatusLine,
} from "./today-hero-ring-parts";

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
  // De-carded v3 hero (ENG-1247, flag today_hero_decard_v3, default OFF). The
  // prototype `.ring-hero` is a BARE centered block — no card chrome — with the
  // status line BELOW the ring (the 'P2' de-card this file long flagged as
  // planned). Validated on the mobile sim: the ring's scale carries the
  // separation, so the audit-gap-6 "slab" concern doesn't manifest in the v3
  // layout. Flag OFF keeps the carded hero below.
  const decard = isFeatureEnabled("today_hero_decard_v3");
  // ENG-1653 tight hero cluster (mobile parity): on the de-carded hero the
  // top chip row was an empty left slot + one right-aligned Coach chip
  // floating in the strip→dial band. With the cluster flag on, the row is
  // dropped and the Coach entry renders at the hero FOOT instead —
  // ENG-1293's every-state guarantee holds in both layouts. Mirrors
  // `TodayHeroRing.tsx` (mobile).
  const clusterHero = isFeatureEnabled("today_hero_cluster_v3");
  const coachAtFoot = decard && clusterHero;
  // ENG-1653 (Grace, sim review): on the cluster hero BONUS always renders —
  // 0 on an empty day — reversing the ENG-1372 law-3 fresh-day suppression
  // for this layout. Legacy (flag-off) keeps the suppression.
  const hideBonusCell = showFreshDayGrammar && bonusKcal <= 0 && !clusterHero;

  // ENG-1653 (Grace, sim review): the macros toggle below the hero had been
  // DEAD since the jewel-dial swap (the dial ignores `expanded`; nothing else
  // read the state). On the cluster hero it becomes the v3 prototype's
  // dial-view switch (Remaining ⇆ Consumed) — local state like the
  // prototype's `calView`. The dial click drives the same switch. Legacy
  // (flag-off) path keeps the existing control untouched. Mobile twin:
  // `TodayHeroRing.tsx`.
  const [dialMode, setDialMode] = React.useState<"remaining" | "consumed">("remaining");
  const toggleDialMode = () =>
    setDialMode((m) => (m === "remaining" ? "consumed" : "remaining"));

  const heroInner = (
    <>
      {/* Carded hero: status CHIP above the ring. De-carded v3 hero: the chip is
          replaced by a centered RingStatusLine BELOW the ring (prototype). The
          Remaining/Consumed toggle stays retired (web ring parity 2026-06-10).
          The Coach chip (ENG-1293) takes the row's right slot in BOTH layouts
          so the entry survives every hero state (with the ENG-1653 cluster
          flag on, it renders at the hero foot instead of this row). */}
      {(!decard || onPressCoach) && !coachAtFoot ? (
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
          // ENG-1465 — restore the legacy `DailyRing` wiring the v3 swap
          // dropped: click-to-toggle + the win/commit pulses the host already
          // feeds this component. ENG-1653 cluster hero: the click flips the
          // Remaining ⇆ Consumed view instead (prototype ring-tap).
          onToggle={clusterHero ? toggleDialMode : onToggleExpanded}
          displayMode={clusterHero ? dialMode : undefined}
          pulse={pulse}
          commitPulse={commitPulse}
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
        data-testid={clusterHero ? "today-ring-view-toggle" : "today-macro-rings-toggle"}
        onClick={clusterHero ? toggleDialMode : onToggleExpanded}
        aria-label={
          clusterHero
            ? dialMode === "remaining"
              ? RING_VIEW_TOGGLE.a11yToConsumed
              : RING_VIEW_TOGGLE.a11yToRemaining
            : undefined
        }
        // ENG-1093 (Grace): both labels of a state pair share one width so the
        // centred control never wobbles between states. `min-w` + centred text
        // pins them to one footprint. Mirrors mobile `minWidth: 84`; the
        // cluster hero's longer pair pins at 180.
        className={`inline-block ${clusterHero ? "min-w-[180px]" : "min-w-[84px]"} text-center text-[11px] font-semibold text-primary-solid hover:opacity-80 transition-opacity`}
      >
        {clusterHero
          ? dialMode === "remaining"
            ? RING_VIEW_TOGGLE.remaining
            : RING_VIEW_TOGGLE.consumed
          : expanded
            ? MACRO_RING_TOGGLE.hide
            : MACRO_RING_TOGGLE.show}
      </button>
      {/* ENG-1653 — the de-orphaned Coach entry at the hero foot (the
          prototype's guide-line slot); see the `coachAtFoot` note above. */}
      {coachAtFoot && onPressCoach ? <HeroCoachChip onPress={onPressCoach} /> : null}
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
