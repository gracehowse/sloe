/**
 * Recipe detail — sticky footer (Figma `332:2`, section 8). Web parity:
 * the sticky footer in `src/app/components/RecipeDetail.tsx`.
 *
 * Left: a YIELD label over a servings stepper (cream round − / value / cream
 * round +). This is the canonical servings control — it REPLACES the old
 * mid-body servings card; ingredient amounts + batch totals scale off it.
 * Right: a clay "Cook Mode" pill → opens Cook Mode.
 *
 * The footer floats over a translucent white surface, safe-area aware.
 */
import { Text, View } from "react-native";
import { Minus, Plus, UtensilsCrossed } from "lucide-react-native";

import { FontFamily, Radius } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { PressableScale } from "@/components/ui/PressableScale";

export function RecipeServingsFooter({
  servings,
  canDecrease,
  canIncrease,
  onDecrease,
  onIncrease,
  onCookMode,
  bottomInset,
  haptic = "none",
}: {
  servings: number;
  canDecrease: boolean;
  canIncrease: boolean;
  onDecrease: () => void;
  onIncrease: () => void;
  onCookMode: () => void;
  bottomInset: number;
  haptic?: "confirm" | "none";
}) {
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the Cook Mode CTA.
  const accent = useAccent();

  const roundBtn = (enabled: boolean) => ({
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    opacity: enabled ? 1 : 0.4,
  });

  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "rgba(255,255,255,0.94)",
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingHorizontal: 24,
        paddingTop: 12,
        paddingBottom: bottomInset + 12,
      }}
      testID="recipe-detail-sticky-footer"
    >
      {/* Left — yield + servings stepper. */}
      <View style={{ gap: 4 }}>
        <Text
          style={{
            fontFamily: FontFamily.sansSemibold,
            fontSize: 10,
            fontWeight: "600",
            letterSpacing: 1,
            textTransform: "uppercase",
            color: colors.textSecondary,
          }}
        >
          Yield
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
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

      {/* Right — Cook Mode. */}
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
          backgroundColor: accent.primary,
        }}
      >
        <UtensilsCrossed size={18} color={colors.primaryForeground} />
        <Text
          style={{
            fontFamily: FontFamily.sansSemibold,
            fontSize: 15,
            fontWeight: "700",
            color: colors.primaryForeground,
          }}
        >
          Cook Mode
        </Text>
      </PressableScale>
    </View>
  );
}
