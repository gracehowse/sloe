/**
 * AiLogReviewSummary — shared totals + overall-confidence pill row used
 * by `VoiceLogSheet` and `PhotoLogSheet`. Surfaces the aggregate
 * confidence (mean of items) so the user can read the overall trust
 * signal at a glance instead of scanning each chip.
 *
 * The aggregate uses `averageConfidence` (shared with web) so the
 * mobile chip and web `AiLogReviewSummary` (TODO: web parity lift)
 * will return identical labels for identical inputs.
 *
 * Pure presentational — caller passes `items` + `slotLabel`.
 */
import { useMemo } from "react";
import { Text, View } from "react-native";

import { Radius, Spacing } from "@/constants/theme";
import {
  aggregateTotals,
  averageConfidence,
  type AiLoggedItem,
} from "@suppr/shared/nutrition/aiLogging";
import { formatMacroTrailer } from "@suppr/shared/nutrition/macroFormat";
import {
  confidenceColor,
  confidenceLabel,
  confidencePercentLabel,
} from "./AiLogReviewItem";

type Theme = {
  text: string;
  textSecondary: string;
  textTertiary: string;
  card: string;
  cardBorder: string;
  background: string;
  inputBg: string;
  border: string;
};

type Props = {
  items: readonly AiLoggedItem[];
  /** Slot label to anchor the totals to ("Breakfast" / "Lunch" / ...). */
  slotLabel: string;
  colors: Theme;
};

export default function AiLogReviewSummary({ items, slotLabel, colors }: Props) {
  const totals = useMemo(() => aggregateTotals(items), [items]);
  const avg = useMemo(() => averageConfidence(items), [items]);
  const cColor = confidenceColor(avg);
  const cLabel = confidenceLabel(avg);
  const cPercent = confidencePercentLabel(avg);

  return (
    <View
      style={{
        backgroundColor: colors.inputBg,
        borderRadius: Radius.md,
        padding: Spacing.md,
        marginTop: 4,
        gap: 6,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <Text
          style={{ fontSize: 12, fontWeight: "700", color: colors.text }}
          accessibilityLabel={`Overall AI confidence ${cPercent}`}
        >
          Overall AI confidence
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            borderRadius: 999,
            paddingHorizontal: 8,
            paddingVertical: 3,
            backgroundColor: cColor + "22",
          }}
        >
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: cColor,
            }}
          />
          <Text
            style={{ fontSize: 11, fontWeight: "700", color: cColor }}
          >
            {cLabel} {cPercent}
          </Text>
        </View>
      </View>
      <Text style={{ fontSize: 12, color: colors.textSecondary }}>
        Logging to{" "}
        <Text style={{ color: colors.text, fontWeight: "700" }}>{slotLabel}</Text>
        . Total: {formatMacroTrailer({
          calories: totals.calories,
          protein: totals.protein,
          carbs: totals.carbs,
          fat: totals.fat,
          fiber: totals.fiber,
        })}
      </Text>
    </View>
  );
}
