import React from "react";
import { Text, View } from "react-native";
import CalorieRing from "@/components/charts/CalorieRing";
import { Layout } from "@/constants/layout";
import { Accent, Radius, Spacing } from "@/constants/theme";

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
  displayMode: "remaining" | "consumed";
  onToggleDisplayMode: () => void;
  textTertiaryColor: string;

  /** Audit gap #10 transparency moat (2026-05-01). When provided, a
   *  small "Why this number?" pill button renders directly under the
   *  ring; tapping it should open the host-owned `WhyThisNumberSheet`.
   *  Sized + spaced so it does not interfere with the ring's tap /
   *  long-press affordances. */
  onPressWhy?: () => void;
}

interface StatProps {
  label: string;
  value: string;
  valueColor: string;
  textSecondaryColor: string;
}

/**
 * Streamlined Goal/Food/Bonus stat. Canonical 2026-05-22 v4: no icon,
 * no divider line. Label sits above the value; value is coloured to
 * match the corresponding ring segment so the stats row visually
 * reads as a numeric legend for the ring above (Goal=neutral text,
 * Food=success green, Bonus=warm orange).
 */
function Stat({ label, value, valueColor, textSecondaryColor }: StatProps) {
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 3 }}>
      <Text
        style={{
          fontSize: 9,
          fontWeight: "600",
          color: textSecondaryColor,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: 14,
          fontWeight: "700",
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

export function TodayHeroRing({
  consumed,
  goal,
  baseGoal,
  textColor,
  secondaryColor,
  trackColor,
  cardBackgroundColor,
  borderColor,
  proteinPct,
  carbsPct,
  fatPct,
  expanded,
  onToggleExpanded,
  displayMode,
  onToggleDisplayMode,
  textTertiaryColor: _textTertiaryColor,
  onPressWhy: _onPressWhy,
}: TodayHeroRingProps) {
  return (
    <View
      style={{
        backgroundColor: cardBackgroundColor,
        borderWidth: 1,
        borderColor: borderColor,
        borderRadius: Radius.lg,
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.md,
        alignItems: "center",
        gap: Layout.todayScrollGap,
      }}
    >
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
        displayMode={displayMode}
        onToggleDisplayMode={onToggleDisplayMode}
      />
      {/* Canonical 2026-05-22 v4 multi-ring revival: Goal / Food /
          Bonus stats row sits directly below the ring inside the
          same hero card. Streamlined per Grace 2026-05-22 follow-up
          — no icons, no vertical dividers; value colour links each
          stat to its ring segment (Food → green arc, Bonus → orange
          arc, Goal → neutral text since it's the whole). Renders
          only when the ring is non-empty so the first-run "Start
          your day" empty state stays clean. */}
      {consumed > 0 && goal > 0 ? (
        <View
          style={{
            width: "100%",
            flexDirection: "row",
            paddingTop: Spacing.sm,
            borderTopWidth: 1,
            borderTopColor: borderColor,
          }}
        >
          <Stat
            label="Goal"
            value={Math.round(goal).toLocaleString()}
            valueColor={textColor}
            textSecondaryColor={secondaryColor}
          />
          <Stat
            label="Food"
            value={Math.round(consumed).toLocaleString()}
            valueColor={Accent.success}
            textSecondaryColor={secondaryColor}
          />
          <Stat
            label="Bonus"
            value={
              baseGoal && baseGoal < goal
                ? Math.round(goal - baseGoal).toLocaleString()
                : "0"
            }
            // Yellow to match activity card + burn-detail screen
            // (`Accent.activity` is the app-wide token for earned-via-
            // exercise calories, distinct from the orange warning/
            // over-budget family as of 2026-05-25).
            valueColor={Accent.activity}
            textSecondaryColor={secondaryColor}
          />
        </View>
      ) : null}
    </View>
  );
}

export default TodayHeroRing;
