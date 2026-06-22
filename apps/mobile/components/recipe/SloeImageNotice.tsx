import { Text, View } from "react-native";
import { Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * SloeImageNotice — the "illustrative, generated" disclaimer shown under an
 * AI-generated recipe hero (extracted from `recipe/[id].tsx` to hold the screen
 * line-budget while ENG-1227 added the report sheet wiring).
 */
export function SloeImageNotice() {
  const colors = useThemeColors();
  return (
    <View style={{ paddingHorizontal: Spacing.md, paddingTop: Spacing.sm }}>
      <Text
        style={{
          ...Type.caption,
          color: colors.textSecondary,
          backgroundColor: colors.card,
          borderRadius: Radius.lg,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.sm,
        }}
      >
        Sloe image is illustrative — generated from title + ingredients. Nutrition is estimated
        separately and may not match the image exactly.
      </Text>
    </View>
  );
}

export default SloeImageNotice;
