/**
 * Recipe detail — sticky footer. Web parity: sticky CTA in
 * `src/app/components/RecipeDetail.tsx`.
 *
 * ENG-1247 v3 (`onLog` supplied): prototype `.pushed-cta` — filled "Cook this"
 * primary + square outline "+" Log. Servings live in the Ingredients
 * section head (`.serv-step`), not here.
 *
 * Flag-OFF (`onLog` omitted): legacy Yield stepper + outline "Cook Mode".
 */
import { Text, View } from "react-native";
import { Minus, Plus, UtensilsCrossed } from "lucide-react-native";

import { FontFamily, Radius, Spacing, Type } from "@/constants/theme";
import { isFeatureEnabled } from "@/lib/analytics";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { PressableScale } from "@/components/ui/PressableScale";
import { SupprButton } from "@/components/ui/SupprButton";

export function RecipeServingsFooter({
  servings,
  canDecrease,
  canIncrease,
  onDecrease,
  onIncrease,
  onCookMode,
  bottomInset,
  haptic = "none",
  onLog,
  logging = false,
}: {
  servings: number;
  canDecrease: boolean;
  canIncrease: boolean;
  onDecrease: () => void;
  onIncrease: () => void;
  onCookMode: () => void;
  bottomInset: number;
  haptic?: "confirm" | "none";
  onLog?: () => void;
  logging?: boolean;
}) {
  const colors = useThemeColors();
  const accent = useAccent();
  const typeScaleV1 = isFeatureEnabled("type_scale_v1");

  const roundBtn = (enabled: boolean) => ({
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    opacity: enabled ? 1 : 0.4,
  });

  const footerChrome = {
    position: "absolute" as const,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 24,
    paddingTop: Spacing.dense,
    paddingBottom: bottomInset + Spacing.dense,
  };

  if (onLog) {
    return (
      <View style={[footerChrome, { gap: Spacing.sm }]} testID="recipe-detail-sticky-footer">
        <View style={{ flex: 1 }}>
          <SupprButton
            variant="primary"
            haptic={haptic}
            onPress={onCookMode}
            accessibilityLabel="Cook this"
            testID="recipe-cook-mode-cta"
            style={{ height: 52, width: "100%", gap: Spacing.sm }}
          >
            <UtensilsCrossed size={18} color="#fff" />
            <Text
              style={{
                ...(typeScaleV1
                  ? Type.button
                  : {
                      fontFamily: Type.bodyLarge.fontFamily,
                      fontSize: Type.bodyLarge.fontSize,
                      lineHeight: Type.bodyLarge.lineHeight,
                      fontWeight: "700",
                    }),
                color: "#fff",
              }}
            >
              Cook this
            </Text>
          </SupprButton>
        </View>
        <PressableScale
          haptic={haptic}
          onPress={onLog}
          disabled={logging}
          accessibilityRole="button"
          accessibilityLabel="Log this recipe"
          testID="recipe-footer-log-cta"
          style={{
            width: 52,
            height: 52,
            borderRadius: Radius.md,
            borderWidth: 1.5,
            borderColor: colors.borderStrong,
            backgroundColor: "transparent",
            justifyContent: "center",
            alignItems: "center",
            opacity: logging ? 0.5 : 1,
          }}
        >
          <Plus size={22} color={colors.text} strokeWidth={2} />
        </PressableScale>
      </View>
    );
  }

  return (
    <View
      style={[footerChrome, { justifyContent: "space-between" }]}
      testID="recipe-detail-sticky-footer"
    >
      <View style={{ gap: 4 }}>
        <Text style={{ ...Type.label, color: colors.textSecondary }}>Yield</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.dense }}>
          <PressableScale
            onPress={onDecrease}
            disabled={!canDecrease}
            accessibilityRole="button"
            accessibilityLabel="Decrease servings"
            testID="recipe-view-servings-minus"
            style={roundBtn(canDecrease)}
          >
            <Minus size={16} color={colors.text} />
          </PressableScale>
          <Text
            style={{
              minWidth: 24,
              textAlign: "center",
              fontFamily: FontFamily.serifRegular,
              fontSize: 20,
              fontWeight: "400",
              color: colors.navPrimary,
              fontVariant: ["tabular-nums"],
            }}
            testID="recipe-view-servings-value"
            accessibilityLiveRegion="polite"
            accessibilityLabel={`${servings} servings`}
          >
            {servings}
          </Text>
          <PressableScale
            onPress={onIncrease}
            disabled={!canIncrease}
            accessibilityRole="button"
            accessibilityLabel="Increase servings"
            testID="recipe-view-servings-plus"
            style={roundBtn(canIncrease)}
          >
            <Plus size={16} color={colors.text} />
          </PressableScale>
        </View>
      </View>

      <PressableScale
        haptic={haptic}
        onPress={onCookMode}
        accessibilityRole="button"
        accessibilityLabel="Start cook mode"
        testID="recipe-cook-mode-cta"
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          height: 52,
          paddingHorizontal: 24,
          borderRadius: Radius.full,
          backgroundColor: "transparent",
          borderWidth: 1.5,
          borderColor: accent.primarySolid,
        }}
      >
        <UtensilsCrossed size={18} color={accent.primarySolid} />
        <Text
          style={{
            ...(typeScaleV1
              ? Type.button
              : {
                  fontFamily: Type.bodyLarge.fontFamily,
                  fontSize: Type.bodyLarge.fontSize,
                  lineHeight: Type.bodyLarge.lineHeight,
                  fontWeight: "700",
                }),
            color: accent.primarySolid,
          }}
        >
          Cook Mode
        </Text>
      </PressableScale>
    </View>
  );
}
