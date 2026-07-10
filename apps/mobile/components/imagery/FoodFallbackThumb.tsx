import * as React from "react";
import { Image, View, type StyleProp, type ViewStyle } from "react-native";
import {
  Apple,
  Beef,
  Coffee,
  Cookie,
  Drumstick,
  Fish,
  Pizza,
  Salad,
  Soup,
  Sun,
  Utensils,
  UtensilsCrossed,
  Wheat,
} from "lucide-react-native";
import type { ComponentType } from "react";
import { Radius } from "@/constants/theme";
import {
  FOOD_FALLBACK_GLYPH_COLOR,
  resolveFoodFallback,
  resolveFoodFallbackSampleCategory,
  type FoodFallbackGlyph,
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

type LucideRnIcon = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

const GLYPHS: Record<FoodFallbackGlyph, LucideRnIcon> = {
  Salad: Salad as LucideRnIcon,
  Beef: Beef as LucideRnIcon,
  Fish: Fish as LucideRnIcon,
  Pizza: Pizza as LucideRnIcon,
  Cookie: Cookie as LucideRnIcon,
  Soup: Soup as LucideRnIcon,
  Wheat: Wheat as LucideRnIcon,
  Utensils: Utensils as LucideRnIcon,
  UtensilsCrossed: UtensilsCrossed as LucideRnIcon,
  Coffee: Coffee as LucideRnIcon,
  Apple: Apple as LucideRnIcon,
  Drumstick: Drumstick as LucideRnIcon,
  Sun: Sun as LucideRnIcon,
};

export interface FoodFallbackThumbProps {
  title: string;
  slot?: MealSlotName | null;
  imageUrl?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Tiered food-row thumbnail (ENG-1448 PR 1, supersedes the ENG-1015
 * sample-or-glyph pair). Real photo when available; else the shipped
 * category sample ONLY on a confident keyword hit; else the slot or
 * generic glyph. The wrapper carries an opaque §11.4 tint underlay so
 * no child failure (broken URL, missing asset) can expose white — and
 * no tier ever fabricates a wrong specific food image.
 */
export function FoodFallbackThumb({
  title,
  slot,
  imageUrl,
  size = 36,
  style,
  testID,
}: FoodFallbackThumbProps) {
  const [errored, setErrored] = React.useState(false);

  const resolution = resolveFoodFallback(title, { slot });
  const sampleCategory =
    resolution.tier === "category"
      ? resolveFoodFallbackSampleCategory(resolution.category)
      : null;
  const sample = sampleCategory
    ? SAMPLE_ASSET_BY_CATEGORY[sampleCategory as keyof typeof SAMPLE_ASSET_BY_CATEGORY]
    : undefined;

  const showPhoto = Boolean(imageUrl) && !errored;
  const source = showPhoto ? { uri: imageUrl! } : sample;
  const Glyph = GLYPHS[resolution.glyph];

  return (
    <View
      testID={
        testID ??
        (source
          ? showPhoto
            ? "food-thumb-photo"
            : `food-fallback-${sampleCategory}`
          : "food-fallback-glyph")
      }
      style={[
        {
          width: size,
          height: size,
          borderRadius: Radius.md,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
        },
        style,
        // Opaque tint underlay — the never-white guarantee. After
        // `style` on purpose: a caller must not paint the wrapper back
        // to a surface colour.
        { backgroundColor: resolution.tint },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {source ? (
        <Image
          source={source}
          style={{ width: "100%", height: "100%" }}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
          onError={showPhoto ? () => setErrored(true) : undefined}
        />
      ) : (
        <Glyph
          size={Math.round(size * 0.44)}
          color={FOOD_FALLBACK_GLYPH_COLOR}
          strokeWidth={1.75}
        />
      )}
    </View>
  );
}

export default FoodFallbackThumb;
