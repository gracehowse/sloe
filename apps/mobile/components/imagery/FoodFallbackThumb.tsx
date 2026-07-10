import * as React from "react";
import { Image, View, type ImageStyle, type StyleProp } from "react-native";
import { Utensils } from "lucide-react-native";
import { Radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import {
  resolveFoodFallbackCategory,
  resolveFoodFallbackSampleCategory,
  type MealSlotName,
} from "@suppr/shared/imagery/foodFallbackCategory";

/** Interim sample assets — swap to production `fallback-<id>.png` when batch ships. */
const SAMPLE_ASSET_BY_CATEGORY = {
  "ramen-noodles": require("@/assets/imagery/fallbacks/samples/ramen-bowl.png"),
  "breakfast-bowl": require("@/assets/imagery/fallbacks/samples/berry-breakfast-bowl.png"),
  chicken: require("@/assets/imagery/fallbacks/samples/roast-chicken.png"),
  salad: require("@/assets/imagery/fallbacks/samples/green-salad.png"),
  pasta: require("@/assets/imagery/fallbacks/samples/pasta-tomato.png"),
  smoothie: require("@/assets/imagery/fallbacks/samples/berry-smoothie.png"),
} as const;

export interface FoodFallbackThumbProps {
  title: string;
  slot?: MealSlotName | null;
  imageUrl?: string | null;
  size?: number;
  style?: StyleProp<ImageStyle>;
  testID?: string;
}

/**
 * Painterly food-row thumbnail (ENG-1015). Real photo when available; else
 * deterministic category sample; else utensil glyph fallback.
 */
export function FoodFallbackThumb({
  title,
  slot,
  imageUrl,
  size = 36,
  style,
  testID,
}: FoodFallbackThumbProps) {
  const colors = useThemeColors();
  const [errored, setErrored] = React.useState(false);

  const baseStyle: ImageStyle = {
    width: size,
    height: size,
    borderRadius: Radius.md,
    backgroundColor: colors.inputBg,
  };

  if (imageUrl && !errored) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={[baseStyle, style]}
        accessibilityIgnoresInvertColors
        testID={testID}
        onError={() => setErrored(true)}
      />
    );
  }

  const category = resolveFoodFallbackCategory({ title, slot });
  // ENG-1478 — null when the category has no shipped sample: render the
  // glyph rather than a wrong specific food image (fish ≠ berry smoothie).
  const sampleCategory = resolveFoodFallbackSampleCategory(category);
  const sample = sampleCategory
    ? SAMPLE_ASSET_BY_CATEGORY[sampleCategory as keyof typeof SAMPLE_ASSET_BY_CATEGORY]
    : undefined;

  if (sample) {
    return (
      <Image
        source={sample}
        style={[baseStyle, style]}
        accessibilityIgnoresInvertColors
        testID={testID ?? `food-fallback-${sampleCategory}`}
        resizeMode="cover"
      />
    );
  }

  return (
    <View
      testID={testID ?? "food-fallback-glyph"}
      style={[
        baseStyle,
        { alignItems: "center", justifyContent: "center" },
        style,
      ]}
    >
      <Utensils size={Math.round(size * 0.44)} color={colors.textTertiary} strokeWidth={1.75} />
    </View>
  );
}

export default FoodFallbackThumb;
