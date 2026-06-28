import React, { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { PressableScale } from "@/components/ui/PressableScale";
// App-resolved scheme (NOT the raw OS scheme) — see hooks/use-color-scheme.
import { useColorScheme } from "@/hooks/use-color-scheme";
import { CircleAlert, CircleCheck, Sparkles } from "lucide-react-native";
import { TodayHeroRingGraphic } from "@/components/today/TodayHeroRingGraphic";
import { TodayHeroStats } from "@/components/today/TodayHeroStats";
import { Layout } from "@/constants/layout";
import { Accent, Colors, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { SupprCard } from "@/components/ui/SupprCard";
import { isFeatureEnabled } from "@/lib/analytics";
import { MACRO_RING_TOGGLE, todayStatusChip } from "@suppr/shared/copy/today";

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
 *   - Long-press → toggles BOTH the central number ("Remaining" ⇆
 *     "Logged") AND the inner protein/carbs/fat sub-rings (show /
 *     hide). User feedback 2026-05-02 ("the click and hold to switch
 *     between views was better showing and hiding macro rings"):
 *     bring back the long-press as the single gesture for both
 *     state changes. Discoverability via the long-press is sufficient
 *     for the ring; the segmented "Remaining / Consumed" chips
 *     introduced in PR #50 were reverted because the user found them
 *     redundant.
 *   - The "Why this number?" pill below the ring is a separate
 *     affordance, unchanged.
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
  /** ENG-889 — coach line inside the hero card below stats (Figma `654:2`). */
  coachLine?: React.ReactNode;
}

/**
 * StatusChip — the calm state pill above the ring (SLOE `01 · Today`
 * frame, chip-left). Three states with Sloe tints + a lucide glyph:
 *   - empty → "Fresh start" (plum text; fill only when tier-v1 flag OFF)
 *   - under → "Under budget" (sage tint, circle-check)
 *   - over  → "Over budget"  (destructive tint, circle-alert)
 * Copy comes from the shared `todayStatusChip` helper (Figma `01 · Today`).
 */
function StatusChip({
  state,
  overByKcal,
  isDark,
  onPress,
}: {
  state: "empty" | "under" | "over";
  overByKcal: number;
  isDark: boolean;
  onPress?: () => void;
}) {
  const tierV1 = isFeatureEnabled("today_tracker_tier_v1");
  const accent = useAccent();
  // Split the sage into a FILL hue (tint bg) and an INK hue (text/icon). The
  // base sage (#5E7C5A) is only 4.0:1 as text on its own tint — borderline; the
  // solid sage (#466046, 6.95:1) carries the label/icon, the lighter sage tints
  // the pill (design-director 2026-06-16: the "Under budget" state cue should
  // read at a glance, not hide).
  const sageFill = isDark ? Accent.successLight : Accent.success;
  const sageInk = isDark ? Accent.successLight : Accent.successSolid;
  const red = isDark ? Accent.destructiveLight : Accent.destructive;
  const plum = useThemeColors().navPrimary; // ENG-1010: one scheme-resolved plum source
  const config =
    state === "over"
      ? { fg: red, bg: `${red}1A`, Icon: CircleAlert }
      : state === "empty"
        ? {
            fg: plum,
            bg: tierV1
              ? "transparent"
              : isDark
                ? Colors.dark.backgroundSecondary
                : Colors.light.ringTrack,
            Icon: Sparkles,
          }
        : {
            fg: sageInk,
            bg: tierV1 ? "transparent" : `${sageFill}2E`,
            Icon: CircleCheck,
          };
  const { fg, bg, Icon } = config;
  const label = todayStatusChip(state, overByKcal);
  const chipStyle = {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: Spacing.xs,
    backgroundColor: bg,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  };
  const chipContent = (
    <>
      <Icon size={14} color={fg} strokeWidth={2} />
      <Text style={{ fontSize: 12, fontWeight: "600", color: fg }}>{label}</Text>
    </>
  );
  if (!onPress) {
    return (
      <View testID="today-ring-status-chip" style={chipStyle}>
        {chipContent}
      </View>
    );
  }
  return (
    <Pressable
      testID="today-ring-status-chip"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}, see how your calorie target was set`}
      style={chipStyle}
    >
      {chipContent}
    </Pressable>
  );
}


/**
 * RingStatusLine — the de-carded v3 hero's status indicator (ENG-1247): a
 * centered dot + label BELOW the ring (prototype `.ring-status`), replacing the
 * carded hero's chip-above-the-ring. Sage when under budget, red when over;
 * hidden on empty days. Copy from the shared `todayStatusChip` helper (no drift).
 */
function RingStatusLine({
  state,
  overByKcal,
  isDark,
}: {
  state: "empty" | "under" | "over";
  overByKcal: number;
  isDark: boolean;
}) {
  if (state === "empty") return null;
  const color =
    state === "over"
      ? isDark
        ? Accent.destructiveLight
        : Accent.destructive
      : isDark
        ? Accent.successLight
        : Accent.successSolid;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.xs }}>
      <View style={{ width: 7, height: 7, borderRadius: Radius.full, backgroundColor: color }} />
      <Text style={{ fontSize: 13, fontWeight: "600", color, letterSpacing: 0.1 }}>
        {todayStatusChip(state, overByKcal)}
      </Text>
    </View>
  );
}

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
  coachLine,
}: TodayHeroRingProps) {
  const accent = useAccent();
  const isDark = useColorScheme() === "dark";
  const tierV1 = isFeatureEnabled("today_tracker_tier_v1");
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

  const heroInner = (
    <>
      {/* Carded hero: status CHIP above the ring. De-carded v3 hero: the chip is
          replaced by a centered RingStatusLine BELOW the ring (prototype). */}
      {!decard ? (
        <View
          style={{
            width: "100%",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: Spacing.xs,
          }}
        >
          <StatusChip
            state={chipState}
            overByKcal={overByKcal}
            isDark={isDark}
            onPress={onPressStatusChip}
          />
        </View>
      ) : null}
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
        onToggleExpanded={onToggleExpanded}
        numeralLarge={decard}
      />
      {decard ? (
        <RingStatusLine state={chipState} overByKcal={overByKcal} isDark={isDark} />
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
      />
      {coachLine}
      {/* Macro-rings toggle (audit gap 5) — a tap-accessible counterpart to
          the ring's long-press macro-rings gesture. The design system (§13)
          requires every gesture to have a tap-accessible equivalent: long-press
          can't be the only path to the inner protein/carbs/fat rings. Mirrors
          web `today-hero-ring.tsx`'s `today-macro-rings-toggle` button + shares
          the `MACRO_RING_TOGGLE` copy so the two surfaces can't drift. Fires
          the same `onToggleExpanded` the long-press does. */}
      {tierV1 ? (
        <PressableScale
          testID="today-macro-rings-toggle"
          haptic="selection"
          onPress={onToggleExpanded}
          accessibilityRole="button"
          accessibilityLabel={expanded ? MACRO_RING_TOGGLE.hide : MACRO_RING_TOGGLE.show}
          hitSlop={8}
          style={{ marginTop: Spacing.xs }}
        >
          <Text
            numberOfLines={1}
            style={{
              fontSize: 11,
              fontWeight: "600",
              color: isDark ? accent.primarySolidDark : accent.primarySolid,
              minWidth: 84,
              textAlign: "center",
            }}
          >
            {expanded ? MACRO_RING_TOGGLE.hide : MACRO_RING_TOGGLE.show}
          </Text>
        </PressableScale>
      ) : (
      <Pressable
        testID="today-macro-rings-toggle"
        onPress={onToggleExpanded}
        accessibilityRole="button"
        accessibilityLabel={expanded ? MACRO_RING_TOGGLE.hide : MACRO_RING_TOGGLE.show}
        hitSlop={8}
        style={({ pressed }) => ({
          marginTop: Spacing.xs,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Text
          numberOfLines={1}
          style={{
            fontSize: 11,
            fontWeight: "600",
            color: isDark ? accent.primarySolidDark : accent.primarySolid,
            // ENG-1093 (Grace): "Hide macros" / "Show macros" are the same width
            // so the centred control never wobbles between states. A fixed
            // minWidth + centred text pins both labels to one footprint (the
            // two strings are equal length but "Show"/"Hide" differ in glyph
            // width). Mirrors web `min-w-[84px] text-center`.
            minWidth: 84,
            textAlign: "center",
          }}
        >
          {expanded ? MACRO_RING_TOGGLE.hide : MACRO_RING_TOGGLE.show}
        </Text>
      </Pressable>
      )}
    </>
  );

  if (decard) {
    // Bare centered hero — no card chrome; the page provides the horizontal
    // padding, so the ring + stats span the full content width (prototype).
    return (
      <View
        style={{
          width: "100%",
          alignItems: "center",
          gap: Layout.todayScrollGap,
          paddingVertical: Spacing.sm,
        }}
      >
        {heroInner}
      </View>
    );
  }

  return (
    // Carded hero (Grace 2026-06-04 shared <SupprCard>; lift soft = audit-gap-6
    // separation, tier-v1 flat-on-cream). The flag-OFF path.
    <SupprCard
      lift={isFeatureEnabled("today_tracker_tier_v1") ? "flat" : "soft"}
      padding="md"
      innerStyle={{ alignItems: "center", gap: Layout.todayScrollGap }}
    >
      {heroInner}
    </SupprCard>
  );
}

export const TodayHeroRing = memo(TodayHeroRingImpl);

export default TodayHeroRing;
