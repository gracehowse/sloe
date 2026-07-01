import { Text, View } from "react-native";
import { Activity } from "lucide-react-native";
import { useRouter } from "expo-router";

import { CARD_RADIUS } from "@/components/ui/SupprCard";
import { IconBox } from "@/components/discover/IconBox";
import Badge from "@/components/Badge";
import { PressableScale } from "@/components/ui/PressableScale";
import { Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useCardElevation } from "@/hooks/useCardElevation";
import { useAccent } from "@/context/theme";
import {
  buildBodyCompositionTrendCopy,
  type BodyCompositionTrendInput,
} from "@suppr/shared/progress/bodyCompositionTrends";
import type { CachedTier } from "@/lib/cachedUserTier";

export type BodyCompositionTrendCardProps = {
  enabled: boolean;
  userTier: CachedTier;
} & BodyCompositionTrendInput;

/**
 * ENG-1237 — Body-composition trends card on Progress (mobile). Pro users see
 * body fat % + derived lean-mass kg with a 90-day delta; Free/Base users see a
 * factual Pro upsell. Gated behind `body_composition_trends_v1` (default-ON).
 * Parity: web `BodyCompositionTrendCard`.
 */
export function BodyCompositionTrendCard({
  enabled,
  userTier,
  ...input
}: BodyCompositionTrendCardProps) {
  const colors = useThemeColors();
  const accent = useAccent();
  const cardElevation = useCardElevation({ variant: "soft" });
  const router = useRouter();

  if (!enabled) return null;

  const isPro = userTier === "pro";
  const copy = isPro ? buildBodyCompositionTrendCopy(input) : null;

  return (
    <View
      testID="progress-body-composition-card"
      accessibilityLabel={
        isPro
          ? `Body composition. Body fat ${copy?.bodyFat.current ?? "unknown"}. Lean mass ${copy?.leanMass.current ?? "unknown"}.`
          : "Body composition. Pro feature."
      }
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
      <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.md }}>
        <IconBox color={accent.primary} size={28}>
          <Activity size={14} color={accent.primary} strokeWidth={1.75} />
        </IconBox>
        <Text style={{ ...Type.headline, color: colors.navPrimary }}>Body composition</Text>
        {!isPro ? <Badge variant="pro">Pro</Badge> : null}
      </View>

      {!isPro ? (
        <>
          <Text style={{ ...Type.body, color: colors.text, lineHeight: 20 }}>
            Track body fat and lean mass trends over time — a quiet read on how your composition is shifting.
          </Text>
          <Text style={{ ...Type.caption, color: colors.textSecondary, marginTop: Spacing.sm, lineHeight: 16 }}>
            Included with Sloe Pro alongside adaptive targets and unlimited imports.
          </Text>
          <PressableScale
            haptic="light"
            onPress={() => router.push("/paywall?from=body_composition" as never)}
            style={{
              marginTop: Spacing.md,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: CARD_RADIUS,
              paddingVertical: Spacing.md,
              alignItems: "center",
            }}
            accessibilityRole="button"
            accessibilityLabel="See Pro plans"
          >
            <Text style={{ ...Type.bodyMedium, color: colors.navPrimary }}>See Pro plans</Text>
          </PressableScale>
        </>
      ) : copy?.hasReadableData ? (
        <View style={{ flexDirection: "row" }}>
          <MetricColumn
            label="Body fat"
            value={copy.bodyFat.current}
            unit="%"
            deltaLabel={copy.bodyFat.deltaLabel}
            colors={colors}
            style={{ flex: 1 }}
          />
          <View style={{ width: 1, backgroundColor: colors.border, marginHorizontal: Spacing.md }} />
          <MetricColumn
            label="Lean mass"
            value={copy.leanMass.current}
            unit="kg"
            deltaLabel={copy.leanMass.deltaLabel}
            colors={colors}
            style={{ flex: 1 }}
          />
        </View>
      ) : (
        <Text style={{ ...Type.body, color: colors.textSecondary, lineHeight: 20 }}>
          Log body fat from Apple Health or your scale — we&apos;ll show how it trends alongside your weight.
        </Text>
      )}
    </View>
  );
}

function MetricColumn({
  label,
  value,
  unit,
  deltaLabel,
  colors,
  style,
}: {
  label: string;
  value: number | null;
  unit: string;
  deltaLabel: string | null;
  colors: { text: string; textSecondary: string; success: string };
  style?: object;
}) {
  const display =
    value != null ? (unit === "%" ? `${value}%` : `${value} ${unit}`) : "—";

  return (
    <View style={style}>
      <Text style={{ ...Type.caption, color: colors.textSecondary, textTransform: "uppercase", marginBottom: Spacing.xs }}>
        {label}
      </Text>
      <Text style={{ ...Type.title, color: colors.text }}>{display}</Text>
      <Text style={{ ...Type.caption, color: deltaLabel ? colors.success : colors.textSecondary, marginTop: Spacing.xs }}>
        {deltaLabel ?? "No trend yet"}
      </Text>
    </View>
  );
}

export default BodyCompositionTrendCard;
