/**
 * Recipe detail — method section (Figma `332:2`, section 7). Web parity:
 * the method section in `src/app/components/RecipeDetail.tsx`.
 *
 * ENG-1247 v3 variant (`variant="v3"`): prototype `.rd-steps` — frost serif
 * index, border-bottom dividers, optional step-count note beside the heading.
 */
import { Text, View } from "react-native";

import { Accent, FontFamily, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

export function RecipeMethodSteps({
  steps,
  variant = "legacy",
  stepCountNote,
}: {
  steps: string[];
  variant?: "legacy" | "v3";
  stepCountNote?: string | null;
}) {
  const colors = useThemeColors();
  if (steps.length === 0) return null;

  if (variant === "v3") {
    return (
      <View style={{ gap: Spacing.sm }} testID="recipe-method-section">
        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
          <Text style={{ ...Type.label, color: colors.textTertiary }}>Method</Text>
          {stepCountNote ? (
            <Text style={{ ...Type.caption, color: colors.textTertiary }}>{stepCountNote}</Text>
          ) : null}
        </View>
        <View>
          {steps.map((step, i) => (
            <View
              key={i}
              style={{
                flexDirection: "row",
                gap: Spacing.lg,
                paddingVertical: 14,
                borderBottomWidth: i < steps.length - 1 ? 1 : 0,
                borderBottomColor: colors.border,
              }}
              testID={`recipe-method-step-${i}`}
            >
              <Text
                style={{
                  fontFamily: FontFamily.serifRegular,
                  fontSize: 28,
                  lineHeight: 30,
                  fontWeight: "400",
                  color: Accent.frost,
                  width: 36,
                  fontVariant: ["tabular-nums"],
                }}
                accessibilityElementsHidden
                importantForAccessibility="no"
              >
                {i + 1}
              </Text>
              <Text
                style={{
                  flex: 1,
                  ...Type.bodyLarge,
                  lineHeight: 23,
                  color: colors.text,
                  paddingTop: 2,
                }}
                accessibilityLabel={`Step ${i + 1}. ${step}`}
              >
                {step}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: 24 }} testID="recipe-method-section">
      <Text style={{ ...Type.title, color: colors.navPrimary }}>Method</Text>
      <View style={{ gap: Spacing.xl }}>
        {steps.map((step, i) => (
          <View key={i} style={{ flexDirection: "row", gap: 16 }} testID={`recipe-method-step-${i}`}>
            <Text
              style={{
                fontFamily: FontFamily.serifRegular,
                fontSize: 30,
                lineHeight: 34,
                fontWeight: "400",
                color: colors.textTertiary,
                width: 40,
              }}
              accessibilityElementsHidden
              importantForAccessibility="no"
            >
              {String(i + 1).padStart(2, "0")}
            </Text>
            <View style={{ flex: 1, justifyContent: "center" }}>
              <Text
                style={{
                  fontFamily: FontFamily.sansRegular,
                  fontSize: 16,
                  lineHeight: 26,
                  color: colors.text,
                }}
                accessibilityLabel={`Step ${i + 1}. ${step}`}
              >
                {step}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
