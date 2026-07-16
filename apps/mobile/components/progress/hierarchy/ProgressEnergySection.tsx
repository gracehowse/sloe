import { Text, View, useColorScheme } from "react-native";

import { SupprCard } from "@/components/ui/SupprCard";
import { HierarchyOverline } from "@/components/progress/hierarchy/HierarchyOverline";
import { Accent, Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useAccent } from "@/context/theme";
import { trendDirectionTone } from "@/lib/weightProjection";
import type { ExpenditureTrendCopy } from "@suppr/shared/progress/expenditureTrend";

/**
 * ENG-1525 §3 — Energy, deficit-led. Re-composes the ProgressEnergyEquation
 * content so ONE number leads (the average daily deficit/surplus) and the
 * equation becomes the support line beneath it, in words with CORRECT
 * arithmetic: maintenance − intake = deficit (surplus when negative).
 * Absorbs the legacy Maintenance card's confidence + adaptive-data-progress
 * disclosures and the standalone ExpenditureTrendCard.
 *
 * Direction-aware colour (delta 3): the deficit implies a weekly rate
 * (kcal/day × 7 ÷ 7,700 kg) which runs through the SAME shared
 * `trendDirectionTone` helper the §1 hero uses — sage when the energy
 * balance moves the user toward their goal weight, amber when it opposes
 * it (never red), plum when no goal is set. The two sections can therefore
 * never disagree about direction.
 */
export interface ProgressEnergySectionProps {
  avgIntakeKcal: number | null;
  /** The SAME 3-day story floor §2 uses (`hasEnoughDataForStory`) — below it
   *  a one-day average would typeset as a confident 4-digit "deficit", so the
   *  numeral gives way to the settling copy instead. */
  hasEnoughData: boolean;
  /** Resolved maintenance (the host's shared `recapMaintenance` — ENG-1506
   *  anti-drift: never re-derived per section). */
  maintenanceKcal: number | null;
  isAdaptive: boolean;
  adaptiveConfidence: "low" | "medium" | "high" | null;
  /** `maintenanceQualifier(...).line` from the host. */
  qualifierLine: string | null;
  /** Real selected-period label (ENG-1030). */
  periodLabel: string | null;
  /** For the direction tone — same inputs as the §1 hero. */
  latestWeightKg: number | null;
  goalWeightKg: number | null;
  /** ENG-953/1506 — the resolved expenditure copy the host already builds
   *  (`expenditureFromResolved` behind energy_numbers_v1). Only its
   *  `detail` texture renders here — the `line` restates the maintenance
   *  kcal this section already leads with (spec: never print the TDEE
   *  twice). */
  expenditureCopy?: ExpenditureTrendCopy | null;
  /** ENG-1189 honest thin-data progress (host `computeAdaptiveDataProgressFromMeals`). */
  adaptiveProgress?: {
    message: string;
    weighIns: number;
    weighInsTarget: number;
    loggingDays: number;
    loggingDaysTarget: number;
  } | null;
  /** Host-owned `<MaintenanceExplainer>` element ("How maintenance works ›"
   *  → the existing explainer, its state + props staying with the host). */
  maintenanceExplainer?: React.ReactNode;
}

/** kcal/day → implied kg/week (7,700 kcal ≈ 1 kg). A deficit (positive
 *  kcal) implies weight LOSS, i.e. a negative signed rate. */
export function impliedRateKgPerWeek(deficitKcal: number | null): number | null {
  if (deficitKcal == null || !Number.isFinite(deficitKcal)) return null;
  return -(deficitKcal * 7) / 7700;
}

export function ProgressEnergySection({
  avgIntakeKcal,
  hasEnoughData,
  maintenanceKcal,
  isAdaptive,
  adaptiveConfidence,
  qualifierLine,
  periodLabel,
  latestWeightKg,
  goalWeightKg,
  expenditureCopy,
  adaptiveProgress,
  maintenanceExplainer,
}: ProgressEnergySectionProps) {
  const colors = useThemeColors();
  const accent = useAccent();
  const isDark = useColorScheme() === "dark";
  const sage = isDark ? Accent.successLight : Accent.successSolid;

  const hasMaintenance = maintenanceKcal != null && maintenanceKcal > 0;
  const deficitKcal =
    hasMaintenance && avgIntakeKcal != null
      ? Math.round(maintenanceKcal - avgIntakeKcal)
      : null;
  const isSurplus = deficitKcal != null && deficitKcal < 0;

  const tone = trendDirectionTone(impliedRateKgPerWeek(deficitKcal), latestWeightKg, goalWeightKg);
  const numeralColor =
    tone === "toward" ? sage : tone === "away" ? colors.overBudgetFg : colors.navPrimary;

  return (
    <SupprCard testID="progress-hierarchy-energy" lift="soft" padding="lg">
      <HierarchyOverline testID="progress-hierarchy-energy-overline">Energy</HierarchyOverline>

      {/* ONE number leads. */}
      <Text style={{ ...Type.statLabel, color: colors.textTertiary }}>
        {isSurplus ? "Average daily surplus" : "Average daily deficit"}
        {periodLabel ? ` · ${periodLabel}` : ""}
      </Text>
      <Text
        testID="progress-hierarchy-energy-deficit"
        style={{ ...Type.display, color: numeralColor, marginTop: Spacing.xs, fontVariant: ["tabular-nums"] }}
      >
        {deficitKcal == null || !hasEnoughData ? "—" : Math.abs(deficitKcal).toLocaleString()}
        {deficitKcal != null && hasEnoughData ? (
          <Text style={{ ...Type.bodyLarge, color: colors.textSecondary }}> kcal</Text>
        ) : null}
      </Text>

      {/* The equation in words — maintenance − intake = deficit. */}
      {hasMaintenance && avgIntakeKcal != null && hasEnoughData ? (
        <Text
          testID="progress-hierarchy-energy-equation"
          style={{ ...Type.captionStrong, fontWeight: "400", color: colors.textSecondary, marginTop: Spacing.xs, fontVariant: ["tabular-nums"] }}
        >
          {maintenanceKcal.toLocaleString()} maintenance − {avgIntakeKcal.toLocaleString()} intake
        </Text>
      ) : (
        <Text style={{ ...Type.captionSmall, color: colors.textSecondary, marginTop: Spacing.xs }}>
          {hasMaintenance && avgIntakeKcal != null
            ? "An honest average needs a few more logged days — keep logging."
            : hasMaintenance
              ? "Log meals to see your energy balance."
              : "Maintenance is still resolving — log meals and weigh in to unlock it."}
        </Text>
      )}

      {/* Confidence — bare overline text, not a pill. */}
      {hasMaintenance ? (
        isAdaptive ? (
          <Text
            testID="progress-hierarchy-energy-confidence"
            style={{ ...Type.label, color: sage, marginTop: Spacing.dense }}
          >
            Adaptive{adaptiveConfidence ? ` · ${adaptiveConfidence} confidence` : ""}
          </Text>
        ) : (
          <Text
            testID="progress-hierarchy-energy-confidence"
            style={{ ...Type.label, color: colors.textTertiary, marginTop: Spacing.dense }}
          >
            Building estimate · low confidence
          </Text>
        )
      ) : null}

      {qualifierLine && hasMaintenance ? (
        <Text style={{ ...Type.captionSmall, color: colors.textTertiary, marginTop: Spacing.xs }}>
          Maintenance: {qualifierLine}
        </Text>
      ) : null}

      {/* Thin data — the honest weigh-ins / logging-days bars (ENG-1189),
          reusing the Maintenance card's block. */}
      {!isAdaptive && adaptiveProgress ? (
        <View testID="progress-hierarchy-energy-progress" style={{ marginTop: Spacing.dense, paddingTop: Spacing.dense, borderTopWidth: 1, borderTopColor: colors.cardBorder }}>
          <Text style={{ ...Type.captionSmall, color: colors.textSecondary, marginBottom: Spacing.sm }}>
            {adaptiveProgress.message}
          </Text>
          <View style={{ flexDirection: "row", gap: Spacing.sm }}>
            {([
              { label: "Weigh-ins", have: adaptiveProgress.weighIns, target: adaptiveProgress.weighInsTarget },
              { label: "Full logging days", have: adaptiveProgress.loggingDays, target: adaptiveProgress.loggingDaysTarget },
            ] as const).map((row) => (
              <View key={row.label} style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.xs }}>
                  <Text style={{ ...Type.caption, fontSize: 10, color: colors.textTertiary }}>{row.label}</Text>
                  <Text style={{ ...Type.caption, fontSize: 10, fontWeight: "600", color: colors.text, fontVariant: ["tabular-nums"] }}>
                    {row.have}/{row.target}
                  </Text>
                </View>
                <View style={{ height: 6, borderRadius: Radius.full, backgroundColor: colors.cardBorder, overflow: "hidden" }}>
                  <View
                    style={{
                      height: "100%",
                      borderRadius: Radius.full,
                      backgroundColor: accent.primarySolid,
                      width: `${Math.min(100, row.target > 0 ? (row.have / row.target) * 100 : 0)}%`,
                    }}
                  />
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Subordinate expenditure texture — the trend/staleness detail only;
          the copy's headline `line` restates the maintenance kcal above, so
          it is intentionally not rendered here (never the TDEE twice). */}
      {expenditureCopy?.detail ? (
        <Text
          testID="progress-hierarchy-energy-expenditure"
          style={{ ...Type.caption, color: colors.textTertiary, marginTop: Spacing.dense }}
        >
          Expenditure · {expenditureCopy.detail}
        </Text>
      ) : null}

      {/* Host-owned MaintenanceExplainer ("How maintenance works ›"). */}
      {maintenanceExplainer ? (
        <View style={{ marginTop: Spacing.dense }}>{maintenanceExplainer}</View>
      ) : null}
    </SupprCard>
  );
}

export default ProgressEnergySection;
