import React from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Accent, Radius, Spacing } from "@/constants/theme";
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
  } = props;
  const [infoOpen, setInfoOpen] = React.useState(false);

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

  let weekBurn = 0;
  let weekConsumed = 0;
  for (const dk of trackerWeekSummaryKeys) {
    weekBurn += (activityBurnByDay[dk] ?? 0) + (basalBurnByDay[dk] ?? 0);
    const dayMeals = byDay[dk] ?? [];
    weekConsumed += dayMeals.reduce((s, m) => s + Math.max(0, m.calories), 0);
  }
  const showWeekly = weekBurn > 0;
  const weekDeficit = weekBurn - weekConsumed;
  const dailyAvgDeficit = Math.round(weekDeficit / 7);
  // 2026-05-05 — single 7700 kcal/kg path; matches onboarding pace
  // promises and whyThisNumber explainer. Was 3500/lb * 0.4536/kg
  // (~0.2% drift across surfaces).
  const weeklyKgRate = weekDeficitToKg(weekDeficit);
  const weeklyLbsRate = weeklyKgRate / 0.4536;
  const isWeekDeficit = weekDeficit >= 0;

  return (
    <View style={styles.card}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: Spacing.sm }}>
        <Ionicons name="flame" size={20} color={Accent.warning} />
        <Text style={[styles.cardTitle, { flex: 1 }]}>Activity Bonus</Text>
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

      <View
        testID="today-activity-bonus-summary-row"
        style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: Spacing.sm }}
      >
        <View style={{ alignItems: "center", flex: 1 }}>
          <Text style={{ fontSize: 20, fontWeight: "800", color: textColor, fontVariant: ["tabular-nums"] }}>
            {totalBurnKcal.toLocaleString()}
          </Text>
          <Text style={{ fontSize: 10, color: textTertiaryColor, marginTop: 2 }}>
            {isToday ? "Burn so far" : "Total burn"}
          </Text>
        </View>
        <View style={{ width: 1, backgroundColor: borderColor }} />
        <View style={{ alignItems: "center", flex: 1 }}>
          <Text style={{ fontSize: 20, fontWeight: "800", color: textColor, fontVariant: ["tabular-nums"] }}>
            {consumedCalories.toLocaleString()}
          </Text>
          <Text style={{ fontSize: 10, color: textTertiaryColor, marginTop: 2 }}>Food logged</Text>
        </View>
        {hasMaintenanceTile ? (
          <>
            <View style={{ width: 1, backgroundColor: borderColor }} />
            <View
              testID="today-activity-bonus-maintenance-tile"
              style={{ alignItems: "center", flex: 1 }}
            >
              <Text style={{ fontSize: 20, fontWeight: "800", color: textColor, fontVariant: ["tabular-nums"] }}>
                {maintenanceTdeeKcal!.toLocaleString()}
              </Text>
              <Text style={{ fontSize: 10, color: textTertiaryColor, marginTop: 2 }}>Maintenance</Text>
            </View>
          </>
        ) : null}
        <View style={{ width: 1, backgroundColor: borderColor }} />
        <View style={{ alignItems: "center", flex: 1 }}>
          {/* P2-31 (TestFlight `AAtW7dYcCBPyBdsMU6UqiQQ`,
              2026-04-25 visual-qa): when no food was logged the
              "Net deficit" was rendered green (success), affirming
              data that's really just "we haven't subtracted anything
              yet". When `consumedCalories === 0` the deficit is just
              the burn — render in neutral grey so the user can tell
              this isn't a real net. */}
          <Text
            style={{
              fontSize: 20,
              fontWeight: "800",
              color:
                consumedCalories === 0
                  ? textSecondaryColor
                  : isDeficit
                    ? Accent.success
                    : Accent.warning,
              fontVariant: ["tabular-nums"],
            }}
          >
            {Math.abs(net).toLocaleString()}
          </Text>
          <Text style={{ fontSize: 10, color: textTertiaryColor, marginTop: 2 }}>
            {isDeficit ? "Net deficit" : "Net surplus"}
          </Text>
        </View>
      </View>

      {effectiveCalorieGoal > 0 && (
        <Text style={{ fontSize: 11, color: textSecondaryColor, marginBottom: Spacing.sm, textAlign: "center" }}>
          Calorie goal for this day: {effectiveCalorieGoal.toLocaleString()} kcal
        </Text>
      )}

      {((activityBurnKcal ?? 0) > 0 || basalBurnKcal > 0) && (
        <Pressable
          onPress={onOpenBurnDetail}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            padding: Spacing.md,
            marginBottom: Spacing.md,
            borderRadius: Radius.md,
            backgroundColor: cardColor,
            borderWidth: 1,
            borderColor: cardBorderColor,
          }}
        >
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="flame-outline" size={14} color={Accent.warning} />
              <Text style={{ fontSize: 13, fontWeight: "700", color: textColor }}>
                {(basalBurnKcal + (activityBurnKcal ?? 0)).toLocaleString()} kcal {isToday ? "burned so far" : "burned"}
              </Text>
              {/* F-131 — small Info icon. Stops the row press from
                  bubbling so the user gets explain-in-place rather
                  than navigating to /burn-detail. */}
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
                    size={14}
                    color={textTertiaryColor}
                  />
                </Pressable>
              ) : null}
            </View>
            <View style={{ flexDirection: "row", gap: Spacing.md }}>
              {(activityBurnKcal ?? 0) > 0 && (
                <Text style={{ fontSize: 11, color: textSecondaryColor }}>
                  Active {(activityBurnKcal ?? 0).toLocaleString()}
                </Text>
              )}
              {basalBurnKcal > 0 && (
                <Text style={{ fontSize: 11, color: textSecondaryColor }}>
                  Resting {basalBurnKcal.toLocaleString()}
                </Text>
              )}
              {todayActivityBudgetAddon > 0 && (
                <Text style={{ fontSize: 11, fontWeight: "700", color: Accent.warning }}>
                  +{todayActivityBudgetAddon.toLocaleString()} bonus earned
                </Text>
              )}
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color={textTertiaryColor} />
        </Pressable>
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
              <Text style={{ fontSize: 12, fontWeight: "700", color: Accent.warning, fontVariant: ["tabular-nums"] }}>
                {w.calories > 0 ? `${w.calories} kcal` : ""}
              </Text>
            </View>
          ))}
        </View>
      )}

      {showWeekly && (
        <View style={{ marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: borderColor }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: textColor, marginBottom: 6 }}>
            {weekSummaryHeading(weekSummaryMode)}
          </Text>
          {/* Audit T13 (2026-05-05) — neutral grey when weekConsumed === 0
              so a user with burn data but zero food logged across the
              window doesn't see "Avg daily deficit: 2,400 kcal" green
              affirming a degenerate state (false success). Mirrors
              the same rule the today-tile got 2026-04-25. */}
          {(() => {
            const isCalibrating = weekConsumed === 0;
            const valueColor = isCalibrating
              ? textSecondaryColor
              : isWeekDeficit
                ? Accent.success
                : Accent.warning;
            return (
              <>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 12, color: textSecondaryColor }}>
                    Avg daily {isWeekDeficit ? "deficit" : "surplus"}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: valueColor,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {Math.abs(dailyAvgDeficit).toLocaleString()} kcal
                  </Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 2 }}>
                  <Text style={{ fontSize: 12, color: textSecondaryColor }}>
                    Weekly {isWeekDeficit ? "deficit" : "surplus"}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: valueColor,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {Math.abs(weekDeficit).toLocaleString()} kcal
                  </Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 2 }}>
                  <Text style={{ fontSize: 12, color: textSecondaryColor }}>
                    Projected weekly {isWeekDeficit ? "loss" : "gain"}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
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
        </View>
      )}

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
              style={{
                maxWidth: 360,
                backgroundColor: cardColor,
                borderRadius: Radius.md,
                padding: Spacing.md,
                borderWidth: 1,
                borderColor: cardBorderColor,
              }}
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
    </View>
  );
}

export default TodayActivityBonusCard;
