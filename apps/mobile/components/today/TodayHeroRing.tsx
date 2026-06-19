import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { PressableScale } from "@/components/ui/PressableScale";
// App-resolved scheme (NOT the raw OS scheme) — see hooks/use-color-scheme.
import { useColorScheme } from "@/hooks/use-color-scheme";
import { CircleAlert, CircleCheck, Sparkles } from "lucide-react-native";
import CalorieRing from "@/components/charts/CalorieRing";
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

interface StatProps {
  label: string;
  value: string;
  valueColor: string;
  labelColor?: string;
  textSecondaryColor: string;
  /** Sloe redesign: a hairline divider on the left of the 2nd/3rd cells
   *  (`divide-x divide-line` in the `01 · Today` frame). */
  dividerColor?: string;
  testID?: string;
}

/**
 * Goal / Eaten / Bonus stat cell. SLOE redesign (2026-06-03, `01 · Today`
 * frame): label `text-[10px] uppercase` above a Newsreader (serif)
 * `text-xl` value, cells separated by a `divide-x divide-line` hairline.
 * The value colour still links each stat to its ring segment where it
 * carries meaning (Bonus → sage when positive, red when over).
 */
function Stat({
  label,
  value,
  valueColor,
  labelColor,
  textSecondaryColor,
  dividerColor,
  testID,
}: StatProps) {
  const tierV1 = isFeatureEnabled("today_tracker_tier_v1");
  return (
    <View
      testID={testID}
      style={{
        flex: 1,
        alignItems: "center",
        gap: Spacing.xs,
        paddingHorizontal: Spacing.sm,
        // Sloe: hairline `divide-x divide-line`, not a 1pt (3px) rule.
        borderLeftWidth: dividerColor ? StyleSheet.hairlineWidth : 0,
        borderLeftColor: dividerColor,
      }}
    >
      <Text
        // 2026-06-16 (design-director): hero-ring metric label → Type.statLabel
        // (600 / 0.5 tracking, not label's 700 / 0.88) so GOAL/EATEN/BONUS read
        // as a calm section label, not shouty caps. Colour defaults to secondary
        // (AA), never tertiary — see call sites.
        style={{ ...Type.statLabel, color: labelColor ?? textSecondaryColor }}
      >
        {label}
      </Text>
      <Text
        style={{
          ...(tierV1 ? Type.statValue : { ...Type.title, fontSize: 19, lineHeight: 23 }),
          color: valueColor,
          fontVariant: ["tabular-nums"],
        }}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
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


export function TodayHeroRing({
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
  return (
    // Card chrome (fill #F6F5F2, radius 24, soft lift, hairline) is the shared
    // <SupprCard> shell — no more hand-rolled per-card chrome (Grace 2026-06-04).
    // Only the ring's inner layout (centred, gap) lives here via innerStyle.
    //
    // lift="soft" (audit gap 6, 2026-06-09): the hero is the single most
    // important card on Today, yet it was explicitly `flat` — on the
    // near-tonal #F6F5F2-on-#FFFFFF pairing that made the whole top of the
    // screen read as one undifferentiated slab (Grace's "cards blend into the
    // background" note). `soft` gives it the cardSoft plum penumbra so it
    // separates from the page like every other resting card. Mirrors web
    // `elevation="card"` on `today-hero-ring.tsx`.
    <SupprCard
      // ENG-1099 M2: flat-on-cream (recipe-screen grammar) when the tier flag is
      // on — the ring is the hero by scale, not shadow; the unified 24 rhythm (M1)
      // carries the separation. Flag-off keeps the 2026-06-09 soft lift.
      lift={isFeatureEnabled("today_tracker_tier_v1") ? "flat" : "soft"}
      // padding md (was lg): the ring is centred in a card far wider than it, so
      // 20pt side padding was wasted air; 16 tightens the hero without touching
      // the ring (design-director 2026-06-16, "too much background" fix).
      padding="md"
      innerStyle={{ alignItems: "center", gap: Layout.todayScrollGap }}
    >
      {/* Chip (state) + Remaining/Consumed toggle — SLOE `01 · Today`
          frame, sits above the ring inside the hero card. */}
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
      <CalorieRing
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
        onToggle={onToggleExpanded}
      />
      {/* Goal / Eaten / Bonus stats row — SLOE `01 · Today` frame.
          2026-06-10 (Grace): renders on EMPTY days too — the empty page
          should mirror populated days; Eaten 0 and Bonus +0 are honest
          numbers, not noise. (Supersedes the calm-empty divergence.) */}
      {goal > 0 ? (
        <View
          style={{
            width: "100%",
            flexDirection: "row",
            // Was paddingTop md (16) + marginTop xs (4) = 20pt of white void
            // between the ring and the hairline rule — the biggest empty pocket
            // in the hero. Trimmed to 8 (design-director 2026-06-16).
            paddingTop: Spacing.sm,
            // Sloe: hairline `border-t border-line` above the stats row.
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: borderColor,
          }}
        >
          <Stat
            label="Goal"
            value={Math.round(goal).toLocaleString()}
            valueColor={textColor}
            labelColor={secondaryColor}
            textSecondaryColor={secondaryColor}
          />
          <Stat
            label="Eaten"
            value={Math.round(consumed).toLocaleString()}
            valueColor={textColor}
            labelColor={secondaryColor}
            textSecondaryColor={secondaryColor}
            dividerColor={borderColor}
          />
          {/* 2026-06-10 (Grace): the right stat is ALWAYS Bonus — the
              over amount already reads in the centre + the chip, and the
              slot-switch hid the earned-burn number exactly when an
              over-budget user most wants to see it. */}

            <Stat
              label="Bonus"
              testID="today-ring-bonus"
              value={
                baseGoal && baseGoal < goal
                  ? `+${Math.round(goal - baseGoal).toLocaleString()}`
                  : "0"
              }
              // Sage (success) for earned headroom — matches the Sloe
              // frame's `text-sage` bonus label + value.
              labelColor={
                baseGoal && baseGoal < goal
                  ? isDark
                    ? Accent.successLight
                    : Accent.success
                  : secondaryColor
              }
              valueColor={
                baseGoal && baseGoal < goal
                  ? isDark
                    ? Accent.successLight
                    : Accent.success
                  : secondaryColor
              }
              textSecondaryColor={secondaryColor}
              dividerColor={borderColor}
            />

        </View>
      ) : null}
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
    </SupprCard>
  );
}

export default TodayHeroRing;
