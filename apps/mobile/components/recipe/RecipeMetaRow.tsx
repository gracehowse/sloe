/**
 * Recipe detail — meta row (Figma `332:2`, section 5). Web parity:
 * the meta row in `src/app/components/RecipeDetail.tsx`.
 *
 * `⏱ 20 min · 🗂 10 items` — icon + text, Inter 14px. Rating + difficulty are
 * intentionally NOT shown: the `recipes` table carries no aggregate rating or
 * difficulty column, and we never invent nutrition-adjacent recipe metadata.
 * Stats are computed by the shared `composeRecipeMeta` helper so web + mobile
 * surface identical visible stats. Renders nothing when no stat is known.
 */
import { Text, View } from "react-native";
import { Clock, LayoutList } from "lucide-react-native";

import { FontFamily } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import type { RecipeMetaStat } from "@/lib/recipe/recipeDetailLayout";

export function RecipeMetaRow({ stats }: { stats: RecipeMetaStat[] }) {
  const colors = useThemeColors();
  if (stats.length === 0) return null;
  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}
      testID="recipe-meta-row"
      accessibilityLabel={stats.map((s) => s.label).join(", ")}
    >
      {stats.map((stat, idx) => (
        <View key={stat.key} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {idx > 0 ? (
            <Text style={{ color: colors.textTertiary, fontSize: 14 }} aria-hidden>
              ·
            </Text>
          ) : null}
          {stat.key === "time" ? (
            <Clock size={15} color={colors.textSecondary} />
          ) : stat.key === "items" ? (
            <LayoutList size={15} color={colors.textSecondary} />
          ) : null}
          <Text
            style={{
              fontFamily: FontFamily.sansRegular,
              fontSize: 14,
              color: colors.textSecondary,
            }}
          >
            {stat.label}
          </Text>
        </View>
      ))}
    </View>
  );
}
