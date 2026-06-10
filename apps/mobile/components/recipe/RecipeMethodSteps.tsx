/**
 * Recipe detail — method section (Figma `332:2`, section 7). Web parity:
 * the method section in `src/app/components/RecipeDetail.tsx`.
 *
 * "Method" (serif 24px) heading, then numbered steps. Each step is a row: a
 * big serif faint-grey number (`01`, `02`, …) beside a column with an optional
 * title and the step paragraph (Inter 16px, line-height 26). When a step has no
 * distinct leading sentence/title we render the paragraph only — never a fake
 * title.
 */
import { Text, View } from "react-native";

import { FontFamily, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

export function RecipeMethodSteps({ steps }: { steps: string[] }) {
  const colors = useThemeColors();
  if (steps.length === 0) return null;
  return (
    <View style={{ gap: 24 }} testID="recipe-method-section">
      <Text
        style={{
          fontFamily: FontFamily.serifRegular,
          fontSize: 24,
          lineHeight: 28,
          fontWeight: "400",
          color: colors.navPrimary,
        }}
      >
        Method
      </Text>
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
                  color: colors.textSecondary,
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
