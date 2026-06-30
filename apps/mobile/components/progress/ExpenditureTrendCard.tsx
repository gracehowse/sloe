import { Text, View } from "react-native";
import { Activity } from "lucide-react-native";

import { CARD_RADIUS } from "@/components/ui/SupprCard";
import { IconBox } from "@/components/discover/IconBox";
import { ConfidenceChip } from "@/components/ui/ConfidenceChip";
import { Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useCardElevation } from "@/hooks/useCardElevation";
import { useAccent } from "@/context/theme";
import {
  buildExpenditureTrendCopy,
  type ExpenditureTrendInput,
} from "@suppr/shared/progress/expenditureTrend";

/**
 * ENG-953 — calm "Expenditure" trend card (mobile). Sits under the Maintenance
 * card on the Progress tab. Reuses the adaptive / measured TDEE ALREADY in
 * `(tabs)/progress.tsx` state (`adaptive_tdee` / `adaptive_tdee_confidence` /
 * `adaptive_tdee_updated_at` + `measured_tdee`) — recomputes nothing. All copy
 * comes from the shared `buildExpenditureTrendCopy` helper so web and mobile
 * can never drift.
 *
 * The screen passes `enabled`, resolved from `expenditure_trend_card`
 * (default-ON since 2026-06-30 — Grace's "always flag on" for beta-window
 * growth builds). On by default; if the flag is removed from
 * `REDESIGN_DEFAULT_ON` (or PostHog kills it) the card hides and the
 * Maintenance card's "How this works" expandable above returns.
 *
 * Body-neutral, soft-confidence: "burning about ~X kcal/day lately" when we
 * have a confident read, "still learning your pattern" otherwise. Never a
 * false-precision integer (the figure is rounded to the nearest 10 in the
 * helper). Card chrome matches its Maintenance sibling exactly: soft-lift
 * SupprCard treatment, `IconBox` + `Type.headline` plum header, `ConfidenceChip`
 * on the right. Parity: web `ExpenditureTrendCard` renders the identical copy
 * behind the same flag.
 */
export function ExpenditureTrendCard({
  enabled,
  adaptiveTdee,
  adaptiveConfidence,
  adaptiveUpdatedAt,
  measuredTdee,
}: { enabled: boolean } & ExpenditureTrendInput) {
  const colors = useThemeColors();
  const accent = useAccent();
  const cardElevation = useCardElevation({ variant: "soft" });

  if (!enabled) return null;

  const copy = buildExpenditureTrendCopy({
    adaptiveTdee,
    adaptiveConfidence,
    adaptiveUpdatedAt,
    measuredTdee,
  });

  return (
    <View
      testID="progress-expenditure-trend-card"
      accessibilityLabel={`Expenditure. ${copy.line}${copy.detail ? ` ${copy.detail}` : ""}`}
      style={[
        {
          backgroundColor: cardElevation.liftBg ?? colors.card,
          borderRadius: CARD_RADIUS,
          borderWidth: cardElevation.useBorder ? 1 : 0,
          borderColor: colors.cardBorder,
          padding: Spacing.lg,
        },
        cardElevation.shadowStyle,
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
          <IconBox color={accent.primary} size={28}>
            <Activity size={14} color={accent.primary} strokeWidth={1.75} />
          </IconBox>
          <Text style={{ ...Type.headline, color: colors.navPrimary }}>Expenditure</Text>
        </View>
        {copy.chipLevel ? (
          <ConfidenceChip level={copy.chipLevel} testID="progress-expenditure-trend-chip" />
        ) : null}
      </View>

      <Text
        testID="progress-expenditure-trend-line"
        style={{ ...Type.body, color: colors.text, lineHeight: 20 }}
      >
        {copy.line}
      </Text>

      {copy.detail ? (
        <Text
          testID="progress-expenditure-trend-detail"
          style={{ ...Type.caption, color: colors.textSecondary, marginTop: Spacing.xs, lineHeight: 16 }}
        >
          {copy.detail}
        </Text>
      ) : null}
    </View>
  );
}

export default ExpenditureTrendCard;
