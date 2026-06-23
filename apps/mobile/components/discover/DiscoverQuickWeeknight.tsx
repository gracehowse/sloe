import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { UtensilsCrossed } from "lucide-react-native";

import { PressableScale } from "@/components/ui/PressableScale";
import { FontFamily, Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { isFeatureEnabled } from "@/lib/analytics";
import type { RecipeCard } from "@/lib/types";
import { deriveQuickWeeknight } from "@suppr/shared/discover/quickWeeknight";
import { creatorTintFor } from "@suppr/shared/discover/creatorChipPresentation";

/**
 * DiscoverQuickWeeknight — the Sloe v3 Discover "Quick weeknight" section
 * (ENG-1225 Block 6, prototype `.w-rgrid` ~L7570): fast recipes surfaced as
 * dense NO-PHOTO tint cards (time pill + serif name + kcal/protein/time meta) in
 * a 2-col grid. Self-gating: renders nothing unless `sloe_v3_discover_editorial`
 * is on AND there are quick recipes. Shares `deriveQuickWeeknight` with web.
 */
export interface DiscoverQuickWeeknightProps {
  /** The Discover feed recipes to filter for quick picks. */
  recipes: RecipeCard[];
  onPressRecipe: (recipe: RecipeCard) => void;
}

function minutesOf(r: RecipeCard): number {
  const prep = Number.isFinite(r.prepTimeMin) ? (r.prepTimeMin as number) : 0;
  const cook = Number.isFinite(r.cookTimeMin) ? (r.cookTimeMin as number) : 0;
  return prep + cook;
}

export function DiscoverQuickWeeknight({
  recipes,
  onPressRecipe,
}: DiscoverQuickWeeknightProps) {
  const colors = useThemeColors();
  const enabled = isFeatureEnabled("sloe_v3_discover_editorial");
  const quick = useMemo(() => deriveQuickWeeknight(recipes), [recipes]);
  if (!enabled || quick.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: colors.text }]}>Quick weeknight</Text>
        <Text style={[styles.sub, { color: colors.textTertiary }]}>
          Fast wins for the nights you have no time
        </Text>
      </View>
      <View style={styles.grid}>
        {quick.map((r) => {
          const mins = minutesOf(r);
          const meta = [
            r.calories > 0 ? `${Math.round(r.calories)} kcal` : null,
            r.protein > 0 ? `${Math.round(r.protein)}g` : null,
            mins > 0 ? `${mins} min` : null,
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <PressableScale
              key={r.id}
              onPress={() => onPressRecipe(r)}
              haptic="selection"
              accessibilityRole="button"
              accessibilityLabel={`${r.title}, ${meta}`}
              style={styles.card}
            >
              <View style={[styles.tint, { backgroundColor: creatorTintFor(r.id) }]}>
                <UtensilsCrossed size={20} color="#fff" style={{ opacity: 0.5 }} />
                {mins > 0 ? (
                  <View style={styles.timePill}>
                    <Text style={styles.timePillText}>{mins} min</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
                {r.title}
              </Text>
              <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
                {meta}
              </Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: Spacing.xl },
  head: { marginBottom: Spacing.sm },
  title: { ...Type.navTitle },
  sub: { ...Type.caption, marginTop: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  card: { width: "48%", marginBottom: Spacing.md },
  tint: {
    aspectRatio: 4 / 3,
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  timePill: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: Radius.full,
  },
  timePillText: { fontSize: 10, fontWeight: "600", color: "#1c1620", fontFamily: FontFamily.sansSemibold },
  name: { fontFamily: FontFamily.serifMedium, fontSize: 15, lineHeight: 19, marginTop: Spacing.sm },
  meta: { ...Type.caption, fontVariant: ["tabular-nums"], marginTop: 2 },
});

export default DiscoverQuickWeeknight;
