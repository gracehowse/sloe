import React, { memo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { PressableScale } from "@/components/ui/PressableScale";
// App-resolved scheme (NOT the raw OS scheme) — see hooks/use-color-scheme.
import { useColorScheme } from "@/hooks/use-color-scheme";
import { TodayHeroRingGraphic } from "@/components/today/TodayHeroRingGraphic";
import {
  RingStatusLine,
  StatusChip,
  TodayCoachChip,
} from "@/components/today/TodayHeroChips";
import { TodayHeroStats } from "@/components/today/TodayHeroStats";
import { TodayFreshDayLogPill } from "@/components/today/TodayFreshDayLogPill";
import { LogConfirmCheck } from "@/components/today/LogConfirmCheck";
import { Layout } from "@/constants/layout";
import { Spacing } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { SupprCard } from "@/components/ui/SupprCard";
import { isFeatureEnabled } from "@/lib/analytics";
import { MACRO_RING_TOGGLE, RING_VIEW_TOGGLE } from "@suppr/shared/copy/today";

/**
 * TodayHeroRing — ring hero variant.
 *
 * Originally extracted from `apps/mobile/app/(tabs)/index.tsx`
 * (audit H3, 2026-04-18) as a thin wrapper over `CalorieRing`.
 * Ported to match the 2026-04-19 Claude Design prototype
 * (`docs/prototypes/2026-04-19-whole-app-experience/project/screens-mobile.jsx`
 *  → `HeroRing`) on 2026-04-20 — then pared back same day to drop the
 * in-card macro-row list + logged/burned/net mini-stats row that
 * duplicate the adherence bar + 2x2 macro tile grid shown below the
 * hero on Today (see `feedback_no_duplicate_today_hero_content.md`).
 *
 * Current behaviour:
 *   - Ring sits inside a bordered card.
 *   - Tap → no-op (the long-press is the canonical mode toggle).
 *   - Long-press → toggles BOTH the central number ("Remaining" ⇆ "Logged")
 *     AND the inner protein/carbs/fat sub-rings (show / hide). User feedback
 *     2026-05-02 brought back the long-press as the single gesture for both;
 *     the segmented "Remaining / Consumed" chips (PR #50) were reverted as
 *     redundant.
 *   - The "Why this number?" pill below the ring is a separate affordance.
 */
export interface TodayHeroRingProps {
  /** @deprecated 2026-06-10 — Remaining/Consumed toggle retired; ignored. */
  displayMode?: "remaining" | "consumed";
  /** @deprecated 2026-06-10 — ignored. */
  onToggleDisplayMode?: () => void;

  consumed: number;
  goal: number;
  baseGoal: number | undefined;
  textColor: string;
  secondaryColor: string;
  trackColor: string;
  cardBackgroundColor: string;
  borderColor: string;

  // Macro progress (0..1) for the inner rings when expanded
  proteinPct: number;
  carbsPct: number;
  fatPct: number;

  // Interaction — host-owned. The long-press fires BOTH callbacks
  // (display-mode AND expand) so the gesture toggles both pieces of
  // state in lock-step. The host owns the actual state transitions.
  expanded: boolean;
  onToggleExpanded: () => void;
  textTertiaryColor: string;

  /** Audit gap #10 transparency moat (2026-05-01). When provided, a
   *  small "Why this number?" pill button renders directly under the
   *  ring; tapping it should open the host-owned `WhyThisNumberSheet`.
   *  Sized + spaced so it does not interfere with the ring's tap /
   *  long-press affordances. */
  onPressWhy?: () => void;
  /** ENG-1184 — tap status chip to open calorie-target explainer on Today. */
  onPressStatusChip?: () => void;
  /** ENG-1293 — always-present labelled Coach entry (sweep decision #3,
   *  2026-07-01). Renders a "Coach" chip in the hero chip row in EVERY state
   *  (over budget, all logged, past days, fasting) — the old deficit-line
   *  deep-link vanished exactly when the user needed it. Host gates on
   *  `coach_screen_v1`. */
  onPressCoach?: () => void;
  /** ENG-889 — coach line inside the hero card below stats (Figma `654:2`). */
  coachLine?: React.ReactNode;
  /** ENG-722 — log-confirm checkmark play counter; overlays a calm sage check
   *  on the ring graphic each time it increments (a durable commit). */
  logConfirmBump?: number;
  /** ENG-1372 — true iff today has zero logged entries (host-computed from
   *  `mealsToday.length === 0`, NOT `consumed === 0` — a 0-kcal logged item
   *  should still count as "logged"). Behind `empty_state_grammar_v1`: swaps
   *  the empty ring track to the warm-tint token, renders the time-aware
   *  {@link TodayFreshDayLogPill} inside the hero, and suppresses the BONUS
   *  stat cell. */
  isFreshDay?: boolean;
  /** Opens the LogSheet scoped to the time-appropriate meal slot from the
   *  fresh-day pill. Required when `isFreshDay` is true. */
  onLogFreshDaySlot?: () => void;
}

// StatusChip / RingStatusLine extracted to `TodayHeroChips.tsx` (ENG-1293) so
// this file stays under the 400-line screen budget; behaviour unchanged.

function TodayHeroRingImpl({
  consumed,
  goal,
  baseGoal,
  textColor,
  secondaryColor,
  trackColor,
  // Card fill is now owned by the shared <SupprCard> shell (neutral = #F6F5F2);
  // the host-passed value is retained in the prop API for call-site stability
  // but no longer drives the outer card. Inner dividers still use `borderColor`.
  cardBackgroundColor: _cardBackgroundColor,
  borderColor,
  proteinPct,
  carbsPct,
  fatPct,
  expanded,
  onToggleExpanded,
  // textTertiaryColor retained in the prop API (call-site stability) but no
  // longer consumed — GOAL/EATEN/BONUS labels moved off tertiary to secondary
  // (AA) on 2026-06-16.
  textTertiaryColor: _textTertiaryColor,
  onPressWhy: _onPressWhy,
  onPressStatusChip,
  onPressCoach,
  coachLine,
  logConfirmBump = 0,
  isFreshDay = false,
  onLogFreshDaySlot,
}: TodayHeroRingProps) {
  const accent = useAccent();
  const isDark = useColorScheme() === "dark";
  // ENG-1372 (empty-state grammar, law 1): on a fresh day the ring's empty
  // track sits on the warm-tint elevation step, not the plum-tinted default
  // — never invisible-on-background. Threaded to the jewel dial itself
  // (`CalorieRingDial`'s `emptyTrackColor` override) since that component
  // resolves `ringTick` from its OWN `useThemeColors()` call, not this
  // prop's now-vestigial `trackColor` (unused by `TodayHeroRingGraphic`
  // since the ENG-1225 jewel-dial swap). Only the FRESH-day case (zero
  // logged entries) qualifies; a merely-under-target-but-logged day keeps
  // the standard tick track.
  const emptyStateGrammarOn = isFeatureEnabled("empty_state_grammar_v1");
  const isEmpty = consumed === 0 || goal <= 0;
  const isOver = goal > 0 && consumed > goal;
  const overByKcal = isOver ? consumed - goal : 0;
  const chipState: "empty" | "under" | "over" = isEmpty
    ? "empty"
    : isOver
      ? "over"
      : "under";
  // De-carded v3 hero (ENG-1247, flag today_hero_decard_v3, default OFF). The
  // prototype `.ring-hero` is a BARE centered block — no card chrome — with the
  // status line BELOW the ring. Validated on sim: the ring's scale carries the
  // separation, so the audit-gap-6 "slab" concern doesn't manifest in the v3
  // layout. Flag OFF keeps the carded hero (soft lift / tier-v1 flat) below.
  const decard = isFeatureEnabled("today_hero_decard_v3");
  // ENG-1653 tight hero cluster: on the de-carded hero the top chip row was
  // a `<View />` + one right-aligned Coach chip floating in the strip→dial
  // band — the exact dead air Grace flagged. With the cluster flag on, that
  // row is dropped, the Coach entry moves to the hero FOOT (the prototype's
  // guide-line slot, still rendered in every hero state — ENG-1293's
  // guarantee holds), and the decard block's top padding goes so the dial
  // sits at the bare cluster gap under the strip.
  const clusterHero = isFeatureEnabled("today_hero_cluster_v3");
  const coachAtFoot = decard && clusterHero;
  // ENG-1653 (Grace, sim review): the macros toggle below the hero had been
  // DEAD since the ENG-1225 jewel-dial swap — the dial ignores `expanded` and
  // the macro section never read it, so `onToggleExpanded` flipped state
  // nothing consumed. On the cluster hero it becomes the v3 prototype's
  // dial-view switch (Remaining ⇆ Consumed), local state like the
  // prototype's `calView` — NOT the retired host-owned `displayMode` prop
  // pair (deprecated 2026-06-10), which stays ignored for call-site
  // stability. The dial tap (prototype ring-tap) drives the same switch.
  // Legacy (flag-off) path keeps the existing control untouched.
  const [dialMode, setDialMode] = useState<"remaining" | "consumed">("remaining");
  const toggleDialMode = () =>
    setDialMode((m) => (m === "remaining" ? "consumed" : "remaining"));

  const heroInner = (
    <>
      {/* Carded hero: status CHIP above the ring. De-carded v3 hero: the chip is
          replaced by a centered RingStatusLine BELOW the ring (prototype). The
          Coach chip (ENG-1293) takes the row's right slot in BOTH layouts so
          the entry survives every hero state — on decard the row renders with
          only the Coach chip (and with the ENG-1653 cluster flag on, the row
          is dropped entirely — the Coach entry renders at the hero foot). */}
      {(!decard || onPressCoach) && !coachAtFoot ? (
        <View
          style={{
            width: "100%",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: Spacing.xs,
          }}
        >
          {!decard ? (
            <StatusChip
              state={chipState}
              overByKcal={overByKcal}
              isDark={isDark}
              onPress={onPressStatusChip}
            />
          ) : (
            <View />
          )}
          {onPressCoach ? <TodayCoachChip onPress={onPressCoach} /> : null}
        </View>
      ) : null}
      {/* ENG-722 — relative wrapper so the log-confirm check centres on the ring. */}
      <View style={{ position: "relative", alignItems: "center", justifyContent: "center" }}>
        <TodayHeroRingGraphic
          consumed={consumed}
          goal={goal}
          baseGoal={baseGoal}
          textColor={textColor}
          secondaryColor={secondaryColor}
          trackColor={trackColor}
          proteinPct={proteinPct}
          carbsPct={carbsPct}
          fatPct={fatPct}
          expanded={expanded}
          // ENG-1653 cluster hero: the dial tap flips the Remaining ⇆
          // Consumed view (prototype ring-tap); legacy path keeps the
          // (dead) macro toggle wiring untouched.
          onToggleExpanded={clusterHero ? toggleDialMode : onToggleExpanded}
          numeralLarge={decard}
          dialDisplayMode={clusterHero ? dialMode : undefined}
        />
        <LogConfirmCheck bump={logConfirmBump} />
      </View>
      {decard ? (
        <RingStatusLine state={chipState} overByKcal={overByKcal} isDark={isDark} />
      ) : null}
      {/* ENG-1372 (law 2) — the fresh-day hero's ONE filled invitation,
          inside the hero (not floating beside a ghost of the data). Only
          when the flag is on AND the host confirms zero logged entries. */}
      {emptyStateGrammarOn && isFreshDay && onLogFreshDaySlot ? (
        <TodayFreshDayLogPill hour={new Date().getHours()} onPress={onLogFreshDaySlot} />
      ) : null}
      {/* Goal / Eaten / Bonus stats row (extracted → TodayHeroStats so the
          carded + de-carded heroes share one source). */}
      <TodayHeroStats
        goal={goal}
        consumed={consumed}
        baseGoal={baseGoal}
        textColor={textColor}
        secondaryColor={secondaryColor}
        borderColor={borderColor}
        isDark={isDark}
        suppressZeroBonus={emptyStateGrammarOn && isFreshDay}
      />
      {coachLine}
      {/* Macro-rings toggle (audit gap 5) — a tap-accessible counterpart to
          the ring's long-press macro-rings gesture. The design system (§13)
          requires every gesture to have a tap-accessible equivalent: long-press
          can't be the only path to the inner protein/carbs/fat rings. Mirrors
          web `today-hero-ring.tsx`'s `today-macro-rings-toggle` button + shares
          the `MACRO_RING_TOGGLE` copy so the two surfaces can't drift. Fires
          the same `onToggleExpanded` the long-press does. */}
      <PressableScale
        testID={clusterHero ? "today-ring-view-toggle" : "today-macro-rings-toggle"}
        haptic="selection"
        onPress={clusterHero ? toggleDialMode : onToggleExpanded}
        accessibilityRole="button"
        accessibilityLabel={
          clusterHero
            ? dialMode === "remaining"
              ? RING_VIEW_TOGGLE.a11yToConsumed
              : RING_VIEW_TOGGLE.a11yToRemaining
            : expanded
              ? MACRO_RING_TOGGLE.hide
              : MACRO_RING_TOGGLE.show
        }
        hitSlop={8}
        style={{ marginTop: Spacing.xs }}
      >
        <Text
          numberOfLines={1}
          style={{
            fontSize: 11,
            fontWeight: "600",
            color: isDark ? accent.primarySolidDark : accent.primarySolid,
            // ENG-1093 (Grace): both labels of a state pair share one width so
            // the centred control never wobbles between states. A fixed
            // minWidth + centred text pins them to one footprint. Mirrors web
            // `min-w-[84px] text-center`; the cluster hero's longer
            // "Remaining/Consumed · tap to switch" pair pins at 180.
            minWidth: clusterHero ? 180 : 84,
            textAlign: "center",
          }}
        >
          {clusterHero
            ? dialMode === "remaining"
              ? RING_VIEW_TOGGLE.remaining
              : RING_VIEW_TOGGLE.consumed
            : expanded
              ? MACRO_RING_TOGGLE.hide
              : MACRO_RING_TOGGLE.show}
        </Text>
      </PressableScale>
      {/* ENG-1653 — the de-orphaned Coach entry at the hero foot (the
          prototype's guide-line slot); see the `coachAtFoot` note above. */}
      {coachAtFoot && onPressCoach ? <TodayCoachChip onPress={onPressCoach} /> : null}
    </>
  );

  if (decard) {
    // Bare centered hero — no card chrome; the page provides the horizontal
    // padding, so the ring + stats span the full content width (prototype).
    // ENG-1653: with the cluster flag on the top padding drops — the dial
    // hangs at the bare cluster gap under the week strip (prototype
    // `.ring-hero` padding 2 0 8).
    return (
      <View
        style={{
          width: "100%",
          alignItems: "center",
          gap: Layout.todayScrollGap,
          paddingTop: clusterHero ? 0 : Spacing.sm,
          paddingBottom: Spacing.sm,
        }}
      >
        {heroInner}
      </View>
    );
  }

  return (
    // Carded hero (Grace 2026-06-04 shared <SupprCard>; recipe-tier flat-on-cream).
    <SupprCard
      lift="flat"
      padding="md"
      innerStyle={{ alignItems: "center", gap: Layout.todayScrollGap }}
    >
      {heroInner}
    </SupprCard>
  );
}

export const TodayHeroRing = memo(TodayHeroRingImpl);

export default TodayHeroRing;
