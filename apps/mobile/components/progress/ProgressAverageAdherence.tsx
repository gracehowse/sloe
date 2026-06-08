import { Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Accent, MacroColors, Spacing, Type } from "@/constants/theme";
import { useCardElevation } from "@/hooks/useCardElevation";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { CARD_RADIUS } from "@/components/ui/SupprCard";
import { formatMacroAdherenceBar } from "@suppr/shared/nutrition/progressWeekReport";

/**
 * ProgressAverageAdherence — Sloe Figma `492:2` "AVERAGE ADHERENCE" card.
 *
 * Big calorie-adherence % + a 5/7-dot on-target streak (sage) + the four
 * macro bars (Protein sage / Carbs clay / Fat amber / Fibre teal). Each
 * bar: label left, value right (with "· over" when over budget), full-width
 * progress bar below. Over-target bars are AMBER (`Accent.warning`), never
 * red — the destructive-red over rule is the calorie-RING carve-out only.
 *
 * Every figure is real (range adherence + `progressRangeStats` macro
 * adherence). The "up N%" week-over-week trend chip only renders when the
 * host supplies a real delta — never fabricated.
 *
 * Mirror: `src/app/components/suppr/progress-average-adherence.tsx`.
 */

export interface AdherenceMacroRow {
  name: "Protein" | "Carbs" | "Fat" | "Fibre";
  pct: number;
  color: string;
}

export interface ProgressAverageAdherenceProps {
  adherencePct: number | null;
  onTargetDays: boolean[];
  macros: AdherenceMacroRow[];
  adherenceDeltaPct?: number | null;
}

function SparkleArrow({ up, color }: { up: boolean; color: string }) {
  // Compact up/down chevron-ish glyph for the trend chip.
  return (
    <Svg width={11} height={11} viewBox="0 0 12 12" fill="none">
      <Path
        d={up ? "M3 8L6 4L9 8" : "M3 4L6 8L9 4"}
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ProgressAverageAdherence({
  adherencePct,
  onTargetDays,
  macros,
  adherenceDeltaPct,
}: ProgressAverageAdherenceProps) {
  const colors = useThemeColors();
  const cardElevation = useCardElevation();
  if (adherencePct == null) return null;
  const sub = colors.textSecondary;
  const text = colors.text;
  return (
    <View
      testID="progress-average-adherence-card"
      style={[
        {
          backgroundColor: cardElevation.liftBg ?? colors.card,
          borderRadius: CARD_RADIUS,
          borderWidth: cardElevation.useBorder ? 1 : 0,
          borderColor: colors.cardBorder,
          padding: 20,
        },
        cardElevation.shadowStyle,
      ]}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Text style={{ fontSize: 11, fontWeight: "700", color: Accent.primarySolid, textTransform: "uppercase", letterSpacing: 0.88 }}>
          Average Adherence
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          {adherenceDeltaPct != null && adherenceDeltaPct !== 0 ? (
            <View
              testID="progress-adherence-trend-chip"
              style={{ flexDirection: "row", alignItems: "center", gap: 3 }}
            >
              <SparkleArrow up={adherenceDeltaPct > 0} color={adherenceDeltaPct > 0 ? Accent.success : sub} />
              <Text style={{ fontSize: 12, fontWeight: "500", color: adherenceDeltaPct > 0 ? Accent.success : sub }}>
                {adherenceDeltaPct > 0 ? "up" : "down"} {Math.abs(adherenceDeltaPct)}%
              </Text>
            </View>
          ) : null}
          {/* On-target streak dots (sage filled / hairline empty). */}
          <View
            testID="progress-adherence-streak-dots"
            accessibilityLabel={`${onTargetDays.filter(Boolean).length} of ${onTargetDays.length} days on target`}
            style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
          >
            {onTargetDays.map((on, i) => (
              <View
                key={i}
                style={{ width: 9, height: 9, borderRadius: 999, backgroundColor: on ? MacroColors.protein : colors.cardBorder }}
              />
            ))}
          </View>
        </View>
      </View>

      {/* ENG-996 — vertical rhythm snapped to the Spacing scale so the
          headline / big % / macro-bar list read with the same calm
          cadence as the sibling weight + THIS WEEK cards. Was a 4/16/12/6
          cascade of off-token gaps; now sm(8) under the overline, lg(20)
          hero-break before the bars, md(16) between rows, sm(8) label→bar.
          Mirror: web `progress-average-adherence.tsx`. */}
      <Text
        testID="progress-adherence-pct"
        style={{ ...Type.display, fontSize: 40, lineHeight: 44, color: text, marginTop: Spacing.sm, fontVariant: ["tabular-nums"] }}
      >
        {adherencePct}
        <Text style={{ fontSize: 22, color: sub }}>%</Text>
      </Text>

      <View style={{ marginTop: Spacing.lg, gap: Spacing.md }}>
        {macros.map(({ name, pct, color }) => {
          const bar = formatMacroAdherenceBar({ adherencePct: pct });
          const tone = bar.isOver ? Accent.warning : color;
          return (
            <View key={name} testID={`progress-adherence-macro-${name.toLowerCase()}`}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
                <Text style={{ fontSize: 13, color: text }}>{name}</Text>
                <Text
                  testID={`progress-adherence-macro-value-${name.toLowerCase()}`}
                  style={{ fontSize: 13, fontWeight: "600", color: text, fontVariant: ["tabular-nums"] }}
                >
                  {bar.label}
                  {bar.isOver ? <Text style={{ color: sub, fontWeight: "400" }}> · over</Text> : null}
                </Text>
              </View>
              <View style={{ marginTop: Spacing.sm, height: 8, borderRadius: 999, backgroundColor: colors.inputBg, overflow: "hidden" }}>
                <View
                  testID={`progress-adherence-bar-${name.toLowerCase()}`}
                  style={{ height: "100%", width: `${bar.barFillPct}%`, borderRadius: 999, backgroundColor: tone }}
                />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default ProgressAverageAdherence;
