import { Image, Text, View } from "react-native";
import { UtensilsCrossed } from "lucide-react-native";
import { useRouter } from "expo-router";
import { PressableScale } from "@/components/ui/PressableScale";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { Radius, Spacing, Type } from "@/constants/theme";
import { normalizeRecipeTitle } from "@suppr/shared/recipes/normalizeRecipeTitle";
import { formatKcalDisplay } from "@suppr/nutrition-core/formatMacro";
import { formatTotalRecipeDuration } from "@suppr/shared/recipes/totalDuration";
import { decodeEntities } from "@/lib/decodeEntities";
import type { CreatorRecipeRow } from "./useCreatorProfile";

export function CreatorRecipeGrid({ recipes }: { recipes: CreatorRecipeRow[] }) {
  const colors = useThemeColors();
  const router = useRouter();

  return (
    <View testID="creator-recipe-grid" style={{ flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm }}>
      {recipes.map((r) => {
        const timeLabel = formatTotalRecipeDuration(r.prep_time_min, r.cook_time_min);
        return (
          <PressableScale
            key={r.id}
            haptic="selection"
            onPress={() => router.push(`/recipe/${r.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`Open ${r.title}`}
            style={{
              width: "48%",
              borderWidth: 1,
              borderColor: colors.cardBorder,
              borderRadius: Radius.lg,
              backgroundColor: colors.card,
              overflow: "hidden",
            }}
          >
            {r.image_url ? (
              <Image
                source={{ uri: r.image_url }}
                style={{ width: "100%", aspectRatio: 4 / 3 }}
                resizeMode="cover"
                accessibilityIgnoresInvertColors
              />
            ) : (
              <View
                style={{
                  width: "100%",
                  aspectRatio: 4 / 3,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.background,
                }}
              >
                <UtensilsCrossed size={24} color={colors.textSecondary} />
              </View>
            )}
            <View style={{ padding: Spacing.sm }}>
              <Text style={{ ...Type.body, fontWeight: "600", color: colors.text }} numberOfLines={2}>
                {normalizeRecipeTitle(decodeEntities(r.title))}
              </Text>
              <Text style={{ ...Type.captionSmall, color: colors.textSecondary, marginTop: Spacing.xs }} numberOfLines={1}>
                {formatKcalDisplay(r.calories ?? 0)} kcal{timeLabel ? ` · ${timeLabel}` : ""}
              </Text>
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}
