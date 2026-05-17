/**
 * RecipePickerGrid — onboarding final step grid (mobile).
 *
 * Production design spec — 2026-04-27 Surface F.
 * Authority: D-2026-04-27-14 + the onboarding-candidate-source decision.
 *
 * Geometry: 2-col mobile, gap 8pt. Tile uses 36×36pt heroEmoji thumb +
 * Type.caption 11pt 600 1.2 line-height. Selected: bg
 * rgba(76,108,224,0.08) + border primary + 12pt Check overlay.
 *
 * Web mirror: `src/app/components/onboarding/recipe-picker-grid.tsx`.
 */

import * as React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Check } from "lucide-react-native";

import { Accent, Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

import {
  ONBOARDING_SEEDS,
  filterOnboardingSeeds,
  type OnboardingSeed,
} from "@/lib/onboardingSeeds";
import {
  derivePickerState,
  pickCounterLabel,
  togglePick,
} from "@suppr/shared/onboarding/finalStep";

export interface RecipePickerGridProps {
  diet?: readonly string[];
  allergies?: readonly string[];
  picked: ReadonlySet<string>;
  onPickedChange: (next: ReadonlySet<string>) => void;
  /** Test override of the seed list. */
  seeds?: readonly OnboardingSeed[];
  testID?: string;
}

export function RecipePickerGrid({
  diet,
  allergies,
  picked,
  onPickedChange,
  seeds,
  testID,
}: RecipePickerGridProps) {
  const colors = useThemeColors();
  const visibleSeeds = React.useMemo(() => {
    const source = seeds ?? ONBOARDING_SEEDS;
    return filterOnboardingSeeds(source, {
      diet: diet ?? [],
      allergies: allergies ?? [],
    });
  }, [seeds, diet, allergies]);

  const state = derivePickerState(picked);

  return (
    <View testID={testID ?? "recipe-picker-grid"} style={styles.root}>
      <View style={styles.grid}>
        {visibleSeeds.map((seed) => {
          const isPicked = picked.has(seed.slug);
          return (
            <Pressable
              key={seed.slug}
              testID={`recipe-picker-tile-${seed.slug}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isPicked }}
              accessibilityLabel={`${seed.title}, ${seed.kcal} kcal, ${seed.protein_g}g protein, ${seed.prepMins} min`}
              onPress={() => onPickedChange(togglePick(picked, seed.slug))}
              style={({ pressed }) => [
                styles.tile,
                {
                  backgroundColor: isPicked
                    ? "rgba(76,108,224,0.08)"
                    : colors.card,
                  borderColor: isPicked ? Accent.primary : colors.cardBorder,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View style={styles.heroEmoji}>
                <Text style={{ fontSize: 24 }}>{seed.heroEmoji}</Text>
              </View>
              <Text
                style={[styles.tileTitle, { color: colors.text }]}
                numberOfLines={2}
              >
                {seed.title}
              </Text>
              <Text
                style={[
                  styles.tileMeta,
                  { color: colors.textSecondary, fontVariant: ["tabular-nums"] },
                ]}
                numberOfLines={1}
              >
                {seed.kcal} kcal · {seed.protein_g}g · {seed.prepMins} min
              </Text>
              {isPicked ? (
                <View
                  testID={`recipe-picker-tile-check-${seed.slug}`}
                  style={styles.checkOverlay}
                >
                  <Check size={12} color="#fff" strokeWidth={2.5} />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <Text
        testID="recipe-picker-counter"
        style={[
          Type.caption,
          { color: colors.textSecondary, textAlign: "center", marginTop: Spacing.sm },
        ]}
      >
        {pickCounterLabel(picked)}
        {state.canSubmit ? "" : `  ·  ${state.ctaLabel}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "column",
    gap: Spacing.sm,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tile: {
    width: "48%",
    minHeight: 110,
    flexDirection: "column",
    alignItems: "flex-start",
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 4,
    position: "relative",
  },
  heroEmoji: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  tileTitle: {
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 13,
  },
  tileMeta: {
    fontSize: 10,
    fontWeight: "500",
  },
  checkOverlay: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: Accent.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default RecipePickerGrid;
