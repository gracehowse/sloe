/**
 * Mobile renderer for the Discover / Library recipe hero fallback.
 * Shared utility in `src/lib/recipe/recipeHeroFallback.ts` picks
 * the bucket + pattern; this file converts that spec to
 * `react-native-svg` primitives. Web parity:
 * `src/app/components/suppr/RecipeHeroFallback.tsx`.
 *
 * See `docs/design/discover-hero-fallback.md` (D8).
 *
 * Lucide-react-native at the pinned version ships all 8 glyphs
 * (Salad, Beef, Fish, Pizza, Cookie, Soup, Wheat, Utensils) — no
 * substitution needed at current pin.
 */
import { memo, useState } from "react";
import { View, type ViewStyle, type StyleProp } from "react-native";
import Svg, {
  Defs,
  LinearGradient,
  Pattern,
  Rect,
  Stop,
  Circle,
  Path,
  G,
} from "react-native-svg";
import {
  Salad,
  Beef,
  Fish,
  Pizza,
  Cookie,
  Soup,
  Wheat,
  Utensils,
} from "lucide-react-native";
import type { ComponentType } from "react";
import {
  getRecipeFallback,
  type RecipeHeroGlyph,
  type RecipeHeroInput,
  type RecipeHeroPattern,
} from "@suppr/shared/recipe/recipeHeroFallback";
import { useResolvedScheme } from "@/context/theme";

type LucideRnIcon = ComponentType<{ size?: number; color?: string }>;

const GLYPHS: Record<RecipeHeroGlyph, LucideRnIcon> = {
  Salad: Salad as LucideRnIcon,
  Beef: Beef as LucideRnIcon,
  Fish: Fish as LucideRnIcon,
  Pizza: Pizza as LucideRnIcon,
  Cookie: Cookie as LucideRnIcon,
  Soup: Soup as LucideRnIcon,
  Wheat: Wheat as LucideRnIcon,
  Utensils: Utensils as LucideRnIcon,
};

export interface RecipeHeroFallbackProps extends RecipeHeroInput {
  /** Icon size in px. Defaults to 32 per §2 of the brief. */
  iconSize?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

function PatternShape({ pattern, stroke }: { pattern: RecipeHeroPattern; stroke: string }) {
  switch (pattern) {
    case "dots":
      return <Circle cx="12" cy="12" r="1.5" fill={stroke} />;
    case "grid":
      return (
        <G>
          <Path d="M12 7 L12 17" stroke={stroke} strokeWidth={1} strokeLinecap="round" />
          <Path d="M7 12 L17 12" stroke={stroke} strokeWidth={1} strokeLinecap="round" />
        </G>
      );
    case "chevron":
      return (
        <Path
          d="M4 16 L12 10 L20 16"
          fill="none"
          stroke={stroke}
          strokeWidth={1}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    case "circles":
      return <Circle cx="12" cy="12" r="5" fill="none" stroke={stroke} strokeWidth={1} />;
  }
}

function RecipeHeroFallbackImpl({ iconSize = 32, style, testID, ...input }: RecipeHeroFallbackProps) {
  // ENG-1528 — dark cards get the dark ramp tile; light is byte-identical.
  const scheme = useResolvedScheme();
  const fb = getRecipeFallback(input, scheme);
  const Glyph = GLYPHS[fb.glyph];
  const patternId = `hero-p-${fb.pattern}-${input.id}`;
  const gradientId = `hero-g-${fb.bucket}-${input.id}`;
  // ENG-1552 — RN has no container queries, so measure the slab and scale the
  // glyph with its smaller dimension (floored at `iconSize` so thumbs are
  // unchanged, capped at 112). Mirrors the web `clamp(iconSize, 30cqmin, 112)`.
  const [box, setBox] = useState({ w: 0, h: 0 });
  const glyphSize =
    box.w > 0 && box.h > 0
      ? Math.max(iconSize, Math.min(112, 0.3 * Math.min(box.w, box.h)))
      : iconSize;
  return (
    <View
      style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }, style]}
      testID={testID ?? `recipe-hero-fallback-${input.id}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setBox((p) => (p.w === width && p.h === height ? p : { w: width, h: height }));
      }}
    >
      <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={fb.gradientStart} />
            <Stop offset="1" stopColor={fb.gradientEnd} />
          </LinearGradient>
          <Pattern
            id={patternId}
            x="0"
            y="0"
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <PatternShape pattern={fb.pattern} stroke={fb.patternColor} />
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill={`url(#${gradientId})`} />
        <Rect x="0" y="0" width="100" height="100" fill={`url(#${patternId})`} />
      </Svg>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Glyph size={glyphSize} color={fb.glyphColor} />
      </View>
    </View>
  );
}

export const RecipeHeroFallback = memo(RecipeHeroFallbackImpl);
