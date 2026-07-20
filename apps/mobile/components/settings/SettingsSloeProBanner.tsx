/**
 * Sloe Pro banner on Settings (Figma 09 `335:2` / `335:23`).
 *
 * Free: sparkle + "Sloe Pro" + Upgrade ghost pill → paywall.
 * Pro: plain status slab (sparkle + "Sloe Pro" + "Active") — no manage
 * affordance. ENG-1615: manage/cancel lives only in the Membership card
 * (groups with promo-code redemption).
 */
import { StyleSheet, Text, View } from "react-native";
import { Sparkles } from "lucide-react-native";
import { Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { CARD_RADIUS } from "@/components/ui/SupprCard";
import { PressableScale } from "@/components/ui/PressableScale";
import { useCardElevation } from "@/hooks/useCardElevation";
import { useThemeColors } from "@/hooks/use-theme-colors";

export function SettingsSloeProBanner({
  isPro,
  onUpgrade,
}: {
  isPro: boolean;
  onUpgrade: () => void;
}) {
  const colors = useThemeColors();
  const accent = useAccent();
  const elevation = useCardElevation();

  const rowStyle = {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: CARD_RADIUS,
    backgroundColor: elevation.liftBg ?? colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardBorder,
    marginTop: Spacing.lg,
  };

  const label = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.dense }}>
      <Sparkles size={18} color={accent.primarySolid} strokeWidth={1.75} />
      <Text
        style={{
          fontFamily: Type.bodyLarge.fontFamily,
          fontSize: Type.bodyLarge.fontSize,
          lineHeight: Type.bodyLarge.lineHeight,
          fontWeight: "600",
          color: accent.primarySolid,
        }}
      >
        Sloe Pro
      </Text>
    </View>
  );

  if (isPro) {
    return (
      <View
        testID="settings-sloe-pro-banner"
        accessibilityRole="text"
        accessibilityLabel="Sloe Pro — active subscription"
        style={rowStyle}
      >
        {label}
        <Text
          style={{
            fontFamily: Type.body.fontFamily,
            fontSize: Type.body.fontSize,
            lineHeight: Type.body.lineHeight,
            fontWeight: "600",
            color: colors.textSecondary,
          }}
        >
          Active
        </Text>
      </View>
    );
  }

  return (
    <PressableScale
      testID="settings-sloe-pro-banner"
      accessibilityRole="button"
      accessibilityLabel="Get Sloe Pro"
      haptic="confirm"
      onPress={onUpgrade}
      style={rowStyle}
    >
      {label}
      <View
        style={{
          paddingHorizontal: Spacing.dense,
          paddingVertical: Spacing.sm,
          borderRadius: Radius.full,
        }}
      >
        <Text
          style={{
            fontFamily: Type.body.fontFamily,
            fontSize: Type.body.fontSize,
            lineHeight: Type.body.lineHeight,
            fontWeight: "700",
            color: accent.primarySolid,
          }}
        >
          Upgrade
        </Text>
      </View>
    </PressableScale>
  );
}
