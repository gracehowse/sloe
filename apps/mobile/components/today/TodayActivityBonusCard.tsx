import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { Flame, Target, TrendingUp, Utensils } from "lucide-react-native";
import { Layout } from "@/constants/layout";
import { Accent, FontFamily, FontWeight, IconSize, MacroColors, Radius, Spacing, Type } from "@/constants/theme";
import { useTodayCardElevation } from "@/hooks/useCardElevation";
import { SupprCard } from "@/components/ui/SupprCard";
import {
  weekSummaryHeading,
  type WeekSummaryMode,
} from "@suppr/shared/nutrition/weekSummaryWindow";
import {
  buildTdeeExplainerCopy,
  calculateBMR,
  type ActivityLevel,
  type Sex,
} from "@/lib/tdee";
import {
  buildMaintenancePopoverCopy,
  type MaintenanceConfidence,
  type MaintenanceSource,
} from "@suppr/shared/nutrition/resolveMaintenance";
import { weekDeficitToKg } from "@suppr/shared/nutrition/maintenanceChain";
import {
  ACTIVITY_BUDGET_DISCOVER_BODY,
  ACTIVITY_BUDGET_DISCOVER_CTA,
  ACTIVITY_BUDGET_DISCOVER_TITLE,
} from "@suppr/shared/nutrition/activityBudgetDiscoverability";
import type { JournalMeal } from "@/lib/nutritionJournal";

/**
 * TodayActivityBonusCard — summary row, burn breakdown, workouts list,
 * and the weekly deficit rollup.
 *
 * Extracted from `apps/mobile/app/(tabs)/index.tsx` (audit H3,
 * 2026-04-18). All data is host-owned; component only renders and
 * fires `onOpenBurnDetail` when the summary row is tapped.
 */
export interface TodayActivityBonusCardProps {
  isToday: boolean;
  hasBurnData: boolean;
  totalBurnKcal: number;
  consumedCalories: number;
  effectiveCalorieGoal: number;
  basalBurnKcal: number;
  activityBurnKcal: number | null;
  todayActivityBudgetAddon: number;
  dayWorkouts: { type: string; minutes: number; calories: number; source: string }[];
  trackerWeekSummaryKeys: string[];
  activityBurnByDay: Record<string, number>;
  basalBurnByDay: Record<string, number>;
  byDay: Record<string, JournalMeal[]>;
  weekSummaryMode: WeekSummaryMode;
  onOpenBurnDetail: () => void;
  styles: Record<string, any>;
  textColor: string;
  textSecondaryColor: string;
  textTertiaryColor: string;
  borderColor: string;
  cardColor: string;
  cardBorderColor: string;
  /**
   * Effective maintenance TDEE for the user (adaptive when confident,
   * else `calculateTDEE` from profile basics). When non-null/positive,
   * the card renders a 4th "Maintenance" tile and the header info icon
   * surfaces a popover with `buildTdeeExplainerCopy`. Pass `null` (not
   * zero) to omit — zero is misleading.
   *
   * Wired 2026-04-18 from `apps/mobile/app/(tabs)/index.tsx` (the
   * `staticTdee` fallback when adaptive isn't confident yet) to close
   * TestFlight `AAtW7dYcCBPyBdsMU6UqiQQ` / `AFdtq8z_FmWRCispqF04Lsk`.
   */
  maintenanceTdeeKcal: number | null;
  /** For the info-popover BMR line. Optional — popover hides when missing. */
  profileSex?: Sex | null;
  profileWeightKg?: number | null;
  profileHeightCm?: number | null;
  profileAge?: number | null;
  profileActivityLevel?: ActivityLevel | null;
  /**
   * F-3 (2026-04-19) — when present, the popover uses the canonical
   * shared copy and picks the adaptive / formula sentence from
   * `maintenanceSource`. When omitted the card falls back to the
   * richer BMR × multiplier breakdown for hosts that haven't wired
   * `resolveMaintenance` yet.
   */
  maintenanceSource?: MaintenanceSource | null;
  maintenanceConfidence?: MaintenanceConfidence;
  /**
   * F-131 (`AMmlpVOqMnaKKdV2dobjjjg`, 2026-05-08): tap-to-explain
   * affordance for the burn-summary row. When provided, renders a
   * small Info icon next to the "{N} kcal burned so far" text and
   * fires this on tap. Host opens the WhereThisComesFromSheet with
   * burn-specific headline + breakdown rows. The existing
   * `onOpenBurnDetail` (which routes to /burn-detail) remains the
   * tap target for the row itself; the info icon is the explain-in-
   * place affordance Grace asked for ("would be helpful to click on
   * here and see what it's made up of").
   */
  onShowBurnProvenance?: () => void;
  /** F-161 — when false and bonus > 0, show one-time enable banner. */
  preferActivityAdjustedCalories?: boolean;
  onEnableActivityBudget?: () => void;
  onDismissActivityBudgetDiscover?: () => void;
  showActivityBudgetDiscoverBanner?: boolean;
}

export function TodayActivityBonusCard(props: TodayActivityBonusCardProps) {
  const {
    isToday,
    hasBurnData,
    totalBurnKcal,
    consumedCalories,
    effectiveCalorieGoal,
    basalBurnKcal,
    activityBurnKcal,
    todayActivityBudgetAddon,
    dayWorkouts,
    trackerWeekSummaryKeys,
    activityBurnByDay,
    basalBurnByDay,
    byDay,
    weekSummaryMode,
    onOpenBurnDetail,
    onShowBurnProvenance,
    styles,
    textColor,
    textSecondaryColor,
    textTertiaryColor,
    borderColor,
    cardColor,
    cardBorderColor,
    maintenanceTdeeKcal,
    profileSex,
    profileWeightKg,
    profileHeightCm,
    profileAge,
    profileActivityLevel,
    maintenanceSource,
    maintenanceConfidence,
    preferActivityAdjustedCalories = true,
    onEnableActivityBudget,
    onDismissActivityBudgetDiscover,
    showActivityBudgetDiscoverBanner = false,
  } = props;
  const cardElevation = useTodayCardElevation();
  const [infoOpen, setInfoOpen] = React.useState(false);
  const showDiscover =
    showActivityBudgetDiscoverBanner &&
    !preferActivityAdjustedCalories &&
    todayActivityBudgetAddon > 0 &&
    isToday;

  // 4th "Maintenance" tile + info popover — render only when we know
  // maintenance TDEE. Zero/null = omit (no misleading "0 kcal" cell).
  // Mirrors web `today-activity-bonus-card.tsx` (TestFlight
  // `AAtW7dYcCBPyBdsMU6UqiQQ` / `AFdtq8z_FmWRCispqF04Lsk`, 2026-04-18).
  const hasMaintenanceTile = maintenanceTdeeKcal != null && maintenanceTdeeKcal > 0;
  const popoverBmr =
    profileSex && profileWeightKg && profileHeightCm && profileAge
      ? Math.round(calculateBMR(profileSex, profileWeightKg, profileHeightCm, profileAge))
      : null;
  const popoverActivity: ActivityLevel = profileActivityLevel ?? "sedentary";
  // F-3 (2026-04-19): prefer the canonical shared copy when the host
  // supplies a resolved source. Keeps this popover byte-identical to
  // web's.
  const popoverCopy =
    hasMaintenanceTile && popoverBmr != null
      ? maintenanceSource
        ? buildMaintenancePopoverCopy({
            kcal: maintenanceTdeeKcal!,
            source: maintenanceSource,
            confidence: maintenanceConfidence ?? null,
            formulaKcal: null,
            adaptiveRejectedAsStale: false,
          })
        : buildTdeeExplainerCopy({
            maintenanceTdeeKcal: maintenanceTdeeKcal!,
            bmrKcal: popoverBmr,
            activityLevel: popoverActivity,
            basalKcal: basalBurnKcal,
            activeKcal: activityBurnKcal ?? 0,
          })
      : null;

  const net = totalBurnKcal - consumedCalories;
  const isDeficit = net >= 0;

  // Sloe TD1 energy-balance gradient marker (sage deficit → frost
  // maintenance → amber surplus). Position is a PRESENTATION of existing
  // data — no new nutrition value. When maintenance is known we place the
  // marker by where intake sits relative to maintenance: eaten == 0 → far
  // left, eaten == maintenance → centre, eaten == 2× maintenance → far
  // right. Without a maintenance value we fall back to the net sign
  // (deficit left of centre, surplus right). Clamped to a small inset so
  // the dot never clips the bar ends.
  const balanceFraction = (() => {
    if (hasMaintenanceTile && maintenanceTdeeKcal! > 0) {
      const frac = consumedCalories / (2 * maintenanceTdeeKcal!);
      return Math.min(0.96, Math.max(0.04, frac));
    }
    if (consumedCalories === 0) return 0.04;
    return isDeficit ? 0.25 : 0.75;
  })();
  // The headline net colour: sage for a deficit, amber for a surplus, but
  // neutral grey when nothing's been eaten yet (the "net" is just the burn
  // — not a real balance), mirroring the summary-tile rule below.
  const netHeadlineColor =
    consumedCalories === 0
      ? textSecondaryColor
      : isDeficit
        ? Accent.success
        : Accent.warning;
  // Plain-language sub-line under the headline (frame: "You've burned 553
  // more than you've eaten today."). Past days read in past tense per the
  // project voice rule.
  const netSubLine =
    consumedCalories === 0
      ? isToday
        ? "Log a meal to see today's balance."
        : "No food logged for this day."
      : isDeficit
        ? `You've burned ${Math.abs(net).toLocaleString()} more than you've eaten${isToday ? " today" : ""}.`
        : `You've eaten ${Math.abs(net).toLocaleString()} more than you've burned${isToday ? " today" : ""}.`;

  // 2026-05-26 fix (Grace): the daily AVERAGE divides by the days
  // actually logged, not a hardcoded /7 — a mid-week calendar window was
  // diluted by empty future days (e.g. 5,002 over 7 read as ~715/day
  // instead of the real per-logged-day figure). The weekly TOTAL +
  // kg-rate still sum over all window days (unchanged). Mirrors the web
  // TodayActivityBonusCard + the deficit-insight banner.
  let weekBurn = 0;
  let weekConsumed = 0;
  let loggedBurn = 0;
  let loggedConsumed = 0;
  let loggedDays = 0;
  for (const dk of trackerWeekSummaryKeys) {
    const dayBurn = (activityBurnByDay[dk] ?? 0) + (basalBurnByDay[dk] ?? 0);
    const dayMeals = byDay[dk] ?? [];
    const dayConsumed = dayMeals.reduce((s, m) => s + Math.max(0, m.calories), 0);
    weekBurn += dayBurn;
    weekConsumed += dayConsumed;
    if (dayMeals.length > 0) {
      loggedBurn += dayBurn;
      loggedConsumed += dayConsumed;
      loggedDays += 1;
    }
  }
  const showWeekly = weekBurn > 0;
  const weekDeficit = weekBurn - weekConsumed;
  const dailyAvgDeficit =
    loggedDays > 0 ? Math.round((loggedBurn - loggedConsumed) / loggedDays) : 0;
  // 2026-05-05 — single 7700 kcal/kg path; matches onboarding pace
  // promises and whyThisNumber explainer. Was 3500/lb * 0.4536/kg
  // (~0.2% drift across surfaces).
  const weeklyKgRate = weekDeficitToKg(weekDeficit);
  const weeklyLbsRate = weeklyKgRate / 0.4536;
  const isWeekDeficit = weekDeficit >= 0;

  const showBurnBreakdown = (activityBurnKcal ?? 0) > 0 || basalBurnKcal > 0;

  return (
    <>
    <View style={{ gap: Layout.todaySectionCardGap }}>
    {/* Figma TD1 — Energy balance is its own flat slab; burn + 7-day are siblings. */}
    <SupprCard
      lift="flat"
      padding="lg"
      testID="today-energy-balance-card"
      innerStyle={{ gap: Spacing.md }}
    >
      {showDiscover ? (
        <View
          style={[{
            marginBottom: Spacing.sm,
            padding: Spacing.sm,
            borderRadius: Radius.md,
            // Sloe: hairline edge (≈1 physical px), not a 1pt (3px) border.
            borderWidth: cardElevation.useBorder ? StyleSheet.hairlineWidth : 0,
            borderColor: cardBorderColor,
            backgroundColor: cardElevation.liftBg ?? cardColor,
          }, cardElevation.shadowStyle]}
        >
          <Text style={{ fontSize: 12, fontWeight: "700", color: textColor }}>{ACTIVITY_BUDGET_DISCOVER_TITLE}</Text>
          <Text style={{ fontSize: 11, color: textSecondaryColor, marginTop: 4, lineHeight: 15 }}>
            {ACTIVITY_BUDGET_DISCOVER_BODY}
          </Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <Pressable
              accessibilityRole="button"
              onPress={onEnableActivityBudget}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: Radius.sm,
                backgroundColor: Accent.primary,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: "700", color: "#fff" }}>{ACTIVITY_BUDGET_DISCOVER_CTA}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss"
              onPress={onDismissActivityBudgetDiscover}
              hitSlop={8}
            >
              <Text style={{ fontSize: 11, fontWeight: "600", color: textSecondaryColor }}>Not now</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {/* Sloe TD1 "Energy balance" header — Newsreader title + info icon
          (preserved testID + gate). The maintenance-TDEE explainer popover
          is unchanged below. */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: Spacing.sm }}>
        <Text style={[styles.cardTitle, { flex: 1, color: MacroColors.calories }]}>Energy balance</Text>
        {popoverCopy ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="What is maintenance TDEE?"
            testID="today-activity-bonus-info-trigger"
            onPress={() => setInfoOpen(true)}
            hitSlop={8}
            style={{ padding: 4 }}
          >
            <Ionicons name="information-circle-outline" size={18} color={textSecondaryColor} />
          </Pressable>
        ) : null}
      </View>

      {!hasBurnData && isToday ? (
        <Text style={{ fontSize: 12, color: textSecondaryColor, marginBottom: Spacing.md, lineHeight: 18 }}>
          No resting or active energy for this day in Suppr yet. Open{" "}
          <Text style={{ fontWeight: "700", color: textColor }}>More → Connected</Text>, enable Apple Health, then pull
          to refresh or revisit this tab to sync.
        </Text>
      ) : null}

      {/* Sloe TD1 energy-balance HERO — the net headline + plain-language
          sub-line + deficit→maintenance→surplus gradient bar. Net moved
          OUT of the summary tile row up into this headline (frame 459:2).
          P2-31 rule preserved: when nothing's been eaten the net is just
          the burn, so the headline reads neutral grey, not affirming
          green. */}
      <View style={{ marginBottom: Spacing.sm }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
          <Text
            testID="today-activity-bonus-net-headline"
            // `Type.ringValue` is now 48px (the Today ring centre, 2026-06-04).
            // This energy-balance card headline is a SECONDARY number inline
            // with a small caption — it keeps the pre-bump 36/36 so the ring
            // bump doesn't silently oversize it. Same serif family/spacing.
            style={{ ...Type.ringValue, fontSize: 36, lineHeight: 36, color: netHeadlineColor, fontVariant: ["tabular-nums"] }}
          >
            {Math.abs(net).toLocaleString()}
          </Text>
          <Text style={{ ...Type.caption, color: textSecondaryColor }}>
            {consumedCalories === 0
              ? "kcal burned so far"
              : isDeficit
                ? "kcal net deficit"
                : "kcal net surplus"}
          </Text>
        </View>
        <Text style={{ fontSize: 12, color: textTertiaryColor, marginTop: 2, marginBottom: Spacing.md }}>
          {netSubLine}
        </Text>

        {(hasBurnData || consumedCalories > 0) ? (
          <>
            {/* Sloe TD1 calm slider — a true deficit↔maintenance↔surplus
                gradient track (sage 0% → frost 50% → amber 100%) with a knob
                at the current position. Matches the Figma TD1 / prototype
                `linear-gradient(90deg,#5E7C5A,#EDEAF1,#C9892C)`. The gradient
                is drawn via `react-native-svg` (already a dependency — no new
                package); the knob stays a plain absolutely-positioned View so
                its left % can be data-driven by `balanceFraction` (a
                PRESENTATION of existing burn/intake — no new nutrition value).
                The track frost stop uses the card's hairline `borderColor` so
                the centre reads as the neutral line, not a hard segment. */}
            <View
              accessibilityRole="progressbar"
              style={{ position: "relative", height: 14, justifyContent: "center", marginBottom: Spacing.sm }}
            >
              <Svg width="100%" height={8}>
                <Defs>
                  <LinearGradient id="energyBalanceTrack" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor={Accent.success} />
                    <Stop offset="0.5" stopColor={borderColor} />
                    <Stop offset="1" stopColor={Accent.warning} />
                  </LinearGradient>
                </Defs>
                {/* rx/ry round the painted track ends (the gradient pill). */}
                <Rect x="0" y="0" width="100%" height={8} rx={4} ry={4} fill="url(#energyBalanceTrack)" />
              </Svg>
              <View
                style={{
                  position: "absolute",
                  top: 0,
                  left: `${balanceFraction * 100}%`,
                  marginLeft: -7,
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  backgroundColor: cardColor,
                  borderWidth: 2,
                  borderColor: isDeficit ? Accent.success : Accent.warning,
                }}
              />
            </View>
            {/* Sloe TD1 axis labels — UPPERCASE small-caps (Figma reads
                "DEFICIT · MAINTENANCE · SURPLUS"). Restored from the Title-case
                pass via Type.label (uppercase + letter-spacing). */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: Spacing.md }}>
              <Text style={{ ...Type.label, color: textTertiaryColor }}>Deficit</Text>
              <Text style={{ ...Type.label, color: textTertiaryColor }}>Maintenance</Text>
              <Text style={{ ...Type.label, color: textTertiaryColor }}>Surplus</Text>
            </View>
          </>
        ) : null}
      </View>

      {/* Burned / Eaten / Maintenance — the supporting stat row (frame's
          3-col `divide-x` set). Net no longer lives here; it's the headline.
          The Maintenance tile keeps its testID + gate (today-vs-past
          parity test). */}
      <View
        testID="today-activity-bonus-summary-row"
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          paddingTop: Spacing.md,
          marginBottom: Spacing.sm,
          // Sloe: hairline `border-t border-line` above the stat row.
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: borderColor,
        }}
      >
        {/* Sloe TD1 stat tiles — each is an icon + UPPERCASE label on the top
            row, with the value below (Figma 459:2 reads a centred
            "[flame] BURNED" / "[fork] EATEN" / "[target] MAINTENANCE", number
            beneath). Type.label carries the uppercase transform + tracking; the
            glyphs are calm lucide strokes at IconSize.sm (the Figma's
            text-[15px]). Burned takes the honey activity hue (it's the burn
            number); Eaten + Maintenance take muted ink so they don't compete. */}
        <View style={{ alignItems: "center", flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 6 }}>
            <Flame size={IconSize.sm} color={Accent.activity} strokeWidth={2} />
            <Text style={{ ...Type.label, color: textTertiaryColor }}>
              Burned
            </Text>
          </View>
          <Text style={{ ...Type.headline, color: textColor, fontVariant: ["tabular-nums"] }}>
            {totalBurnKcal.toLocaleString()}
          </Text>
        </View>
        {/* Sloe: hairline `divide-x divide-line` between stat tiles. */}
        <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: borderColor }} />
        <View style={{ alignItems: "center", flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 6 }}>
            <Utensils size={IconSize.sm} color={textSecondaryColor} strokeWidth={2} />
            <Text style={{ ...Type.label, color: textTertiaryColor }}>
              Eaten
            </Text>
          </View>
          <Text style={{ ...Type.headline, color: textColor, fontVariant: ["tabular-nums"] }}>
            {consumedCalories.toLocaleString()}
          </Text>
        </View>
        {hasMaintenanceTile ? (
          <>
            {/* Sloe: hairline `divide-x divide-line` before the maintenance tile. */}
            <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: borderColor }} />
            <View
              testID="today-activity-bonus-maintenance-tile"
              style={{ alignItems: "center", flex: 1 }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 6 }}>
                <Target size={IconSize.sm} color={textSecondaryColor} strokeWidth={2} />
                <Text style={{ ...Type.label, color: textTertiaryColor }}>
                  Maintenance
                </Text>
              </View>
              <Text style={{ ...Type.headline, color: textColor, fontVariant: ["tabular-nums"] }}>
                {maintenanceTdeeKcal!.toLocaleString()}
              </Text>
            </View>
          </>
        ) : null}
      </View>

      {effectiveCalorieGoal > 0 && (
        <Text style={{ fontSize: 11, color: textSecondaryColor, marginBottom: Spacing.sm, textAlign: "center" }}>
          Calorie goal {isToday ? "today" : "for this day"} ·{" "}
          <Text style={{ color: textColor, fontWeight: "600" }}>{effectiveCalorieGoal.toLocaleString()} kcal</Text>
        </Text>
      )}

      {dayWorkouts.length > 0 && (
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: textColor, marginBottom: 2 }}>Workouts</Text>
          {dayWorkouts.map((w, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 }}>
              <Ionicons name="barbell-outline" size={16} color={Accent.primary} />
              <Text style={{ fontSize: 13, color: textColor, flex: 1 }}>{w.type}</Text>
              <Text style={{ fontSize: 12, color: textSecondaryColor, fontVariant: ["tabular-nums"] }}>
                {w.minutes > 0 ? `${w.minutes} min` : ""}
              </Text>
              <Text style={{ fontSize: 12, fontWeight: "700", color: Accent.activity, fontVariant: ["tabular-nums"] }}>
                {w.calories > 0 ? `${w.calories} kcal` : ""}
              </Text>
            </View>
          ))}
        </View>
      )}
    </SupprCard>

      {showBurnBreakdown ? (
        <Pressable
          onPress={onOpenBurnDetail}
          style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
        >
          <SupprCard
            lift="flat"
            padding="lg"
            testID="today-burn-breakdown-card"
            innerStyle={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: Spacing.sm,
            }}
          >
            <View style={{ flex: 1, gap: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
                <Flame size={IconSize.lg} color={Accent.activity} strokeWidth={2} />
                <Text
                  testID="today-burn-card-headline"
                  style={{ ...Type.headline, color: textColor, fontVariant: ["tabular-nums"] }}
                >
                  {(basalBurnKcal + (activityBurnKcal ?? 0)).toLocaleString()}
                </Text>
                <Text style={{ ...Type.caption, color: textSecondaryColor }}>
                  kcal {isToday ? "burned so far" : "burned"}
                </Text>
                {onShowBurnProvenance ? (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation?.();
                      onShowBurnProvenance();
                    }}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel="Where this number comes from"
                    testID="today-burn-provenance-info"
                  >
                    <Ionicons
                      name="information-circle-outline"
                      size={IconSize.md}
                      color={textTertiaryColor}
                    />
                  </Pressable>
                ) : null}
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: Spacing.md }}>
                {(activityBurnKcal ?? 0) > 0 && (
                  <Text style={{ ...Type.caption, color: textSecondaryColor }}>
                    Active {(activityBurnKcal ?? 0).toLocaleString()}
                  </Text>
                )}
                {basalBurnKcal > 0 && (
                  <Text style={{ ...Type.caption, color: textSecondaryColor }}>
                    Resting {basalBurnKcal.toLocaleString()}
                  </Text>
                )}
                {todayActivityBudgetAddon > 0 && (
                  <Text
                    style={{
                      ...Type.caption,
                      fontFamily: FontFamily.sansSemibold,
                      fontWeight: FontWeight.semibold,
                      color: Accent.activity,
                    }}
                  >
                    +{todayActivityBudgetAddon.toLocaleString()} bonus earned
                  </Text>
                )}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={IconSize.base} color={textTertiaryColor} />
          </SupprCard>
        </Pressable>
      ) : null}

      {showWeekly ? (
        <SupprCard lift="flat" padding="lg" testID="today-weekly-rolling-card">
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: Spacing.sm }}>
            <TrendingUp size={14} color={Accent.success} strokeWidth={2} />
            <Text style={{ ...Type.label, color: textTertiaryColor }}>
              {weekSummaryHeading(weekSummaryMode)}
            </Text>
          </View>
          {(() => {
            const isCalibrating = weekConsumed === 0;
            const valueColor = isCalibrating
              ? textSecondaryColor
              : isWeekDeficit
                ? Accent.success
                : Accent.warning;
            return (
              <>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontSize: 14, color: textSecondaryColor }}>
                    Avg daily {isWeekDeficit ? "deficit" : "surplus"}
                  </Text>
                  <Text
                    style={{
                      ...Type.headline,
                      color: valueColor,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {Math.abs(dailyAvgDeficit).toLocaleString()} kcal
                  </Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: Spacing.sm }}>
                  <Text style={{ fontSize: 14, color: textSecondaryColor }}>
                    Weekly {isWeekDeficit ? "deficit" : "surplus"}
                  </Text>
                  <Text
                    style={{
                      ...Type.headline,
                      color: valueColor,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {Math.abs(weekDeficit).toLocaleString()} kcal
                  </Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: Spacing.sm }}>
                  <Text style={{ fontSize: 14, color: textSecondaryColor }}>
                    Projected weekly {isWeekDeficit ? "loss" : "gain"}
                  </Text>
                  <Text
                    style={{
                      ...Type.headline,
                      color: valueColor,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {weeklyKgRate.toFixed(2)} kg
                  </Text>
                </View>
              </>
            );
          })()}
        </SupprCard>
      ) : null}
    </View>

      {popoverCopy ? (
        <Modal
          visible={infoOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setInfoOpen(false)}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss TDEE explainer"
            onPress={() => setInfoOpen(false)}
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.4)",
              justifyContent: "center",
              alignItems: "center",
              padding: Spacing.lg,
            }}
          >
            <View
              testID="today-activity-bonus-info-content"
              style={[{
                maxWidth: 360,
                backgroundColor: cardElevation.liftBg ?? cardColor,
                borderRadius: Radius.md,
                padding: Spacing.md,
                borderWidth: cardElevation.useBorder ? 1 : 0,
                borderColor: cardBorderColor,
              }, cardElevation.shadowStyle]}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: textColor, marginBottom: Spacing.sm }}>
                Maintenance TDEE
              </Text>
              <Text style={{ fontSize: 13, color: textSecondaryColor, lineHeight: 19 }}>
                {popoverCopy}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={() => setInfoOpen(false)}
                style={{ marginTop: Spacing.sm, paddingVertical: 8, alignItems: "flex-end" }}
              >
                <Text style={{ fontSize: 13, fontWeight: "700", color: Accent.primary }}>Close</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      ) : null}
    </>
  );
}

export default TodayActivityBonusCard;
