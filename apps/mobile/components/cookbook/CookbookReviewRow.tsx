/**
 * CookbookReviewRow — a single recipe row in the cookbook import review list.
 * Extracted to keep cookbook-import.tsx under the 400-line limit (ENG-621).
 *
 * Design:
 * - DS §2.3 rule 2: recipe name always serif (Type.headline / serifMedium).
 * - DS §11.4: warm fallback thumbnail (sage → card gradient + UtensilsCrossed).
 * - DS §6.2: included state = 2pt terracotta border + 6% tint. Excluded = dimmed.
 * - DS §10.1: visible trailing checkbox affordance (not opacity-only strikethrough).
 */
import { Pressable, Text, View } from "react-native";
import { CheckCircle, UtensilsCrossed } from "lucide-react-native";
import { Elevation, FontFamily, Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useAccent } from "@/context/theme";
import type { PlanImportVerifiedRecipe, PlanImportNutritionMode } from "@suppr/shared/planning/planImport/types";

type Props = {
  item: PlanImportVerifiedRecipe;
  excluded: boolean;
  nutritionMode: PlanImportNutritionMode;
  onToggle: (key: string) => void;
};

export function CookbookReviewRow({ item, excluded, nutritionMode, onToggle }: Props) {
  const colors = useThemeColors();
  const accent = useAccent();

  const kcal =
    nutritionMode === "author" && item.authorNutrition?.calories
      ? item.authorNutrition.calories
      : item.supprNutrition.calories;

  // DS §6.2: included = 2pt terracotta border + soft tint. Excluded = dimmed.
  const cardStyle = excluded
    ? { borderWidth: 1, borderColor: colors.border, opacity: 0.55 }
    : { borderWidth: 2, borderColor: accent.primary, backgroundColor: accent.primarySoft };

  return (
    <Pressable
      onPress={() => onToggle(item.key)}
      testID={`cookbook-recipe-${item.key}`}
      // Elevation on outer wrapper (RN overflow:hidden clips iOS shadows on inner).
      style={{
        borderRadius: Radius.lg,
        marginBottom: Spacing.md,
        ...Elevation.cardSoft,
      }}
    >
      <View
        style={[
          {
            backgroundColor: colors.card,
            borderRadius: Radius.lg,
            padding: Spacing.md,
          },
          cardStyle,
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {/* DS §11.4: warm fallback thumbnail — sage card + pan icon. */}
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: Radius.lg,
              backgroundColor: colors.background,
              alignItems: "center",
              justifyContent: "center",
              marginRight: Spacing.sm,
              flexShrink: 0,
            }}
          >
            <UtensilsCrossed size={18} color={colors.icon} strokeWidth={1.5} />
          </View>

          {/* Content column. */}
          <View style={{ flex: 1, minWidth: 0 }}>
            {/* DS §2.3 rule 2: recipe name always serif. */}
            <Text
              style={{ ...Type.headline, color: colors.text }}
              numberOfLines={2}
            >
              {item.title}
            </Text>
            <Text
              style={{
                fontFamily: FontFamily.sansRegular,
                fontSize: 12,
                color: colors.textSecondary,
                marginTop: Spacing.xs,
              }}
            >
              Serves {item.serves} · {item.ingredientCount ?? item.ingredients.length}{" "}
              ingredients · {item.confidence} confidence
            </Text>
          </View>

          {/* Trailing: kcal value + checkbox. */}
          <View style={{ alignItems: "flex-end", marginLeft: Spacing.sm, flexShrink: 0 }}>
            {/* DS §2.3: numeric value — serifMedium for editorial data. */}
            <Text
              style={{
                fontFamily: FontFamily.serifMedium,
                fontSize: 15,
                color: colors.text,
              }}
            >
              {kcal} kcal
            </Text>
            {/* DS §10.1: trailing checkbox control. */}
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: Radius.md,
                borderWidth: 1.5,
                alignItems: "center",
                justifyContent: "center",
                marginTop: Spacing.xs,
                borderColor: excluded ? colors.border : accent.primary,
                backgroundColor: excluded ? "transparent" : accent.primarySoft,
              }}
            >
              {!excluded ? (
                <CheckCircle size={14} color={accent.primary} strokeWidth={2} />
              ) : null}
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
