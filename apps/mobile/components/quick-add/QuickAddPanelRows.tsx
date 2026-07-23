import { Text, View, type ViewStyle } from "react-native";
import { MoreVertical, PlusCircle, Star as StarIcon } from "lucide-react-native";
import Badge from "@/components/Badge";
import { PressableScale } from "@/components/ui/PressableScale";
import { SourceDot } from "@/components/ui/SourceDot";
import { Accent, IconSize, Radius, Spacing, Type } from "@/constants/theme";
import { formatMacroTrailer } from "@suppr/nutrition-core/macroFormat";
import { isAiSourcedFoodHistoryItem, type FoodHistoryItem } from "@suppr/nutrition-core/foodHistory";
import { mapMealSourceToDot } from "@suppr/nutrition-core/sourceMap";
import { dominantSavedMealSource } from "@suppr/nutrition-core/savedMealsLogic";
import type { SavedMeal } from "@suppr/nutrition-core/savedMeals";

type Tab = "saved" | "recent" | "frequent" | "favourites";
const TAB_LABELS: Record<Tab, string> = {
  saved: "Usual meals",
  recent: "Recent",
  frequent: "Frequent",
  favourites: "Favourites",
};

type Row = FoodHistoryItem & { favoriteId?: string };

export function QuickAddTabRow({
  tab,
  onSelectTab,
  colors,
  accent,
}: {
  tab: Tab;
  onSelectTab: (next: Tab) => void;
  colors: { card: string; textSecondary: string };
  accent: { primarySoft: string; primarySolid: string };
}) {
  return (
    <View style={{ flexDirection: "row", gap: Spacing.xs, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.sm }} accessibilityRole="tablist">
      {(Object.keys(TAB_LABELS) as Tab[]).map((t) => {
        const active = tab === t;
        return (
          <PressableScale
            key={t}
            haptic="selection"
            onPress={() => onSelectTab(t)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${TAB_LABELS[t]} tab`}
            style={{ flex: 1, paddingVertical: 4, borderRadius: Radius.sm, alignItems: "center", backgroundColor: active ? accent.primarySoft : colors.card }}
          >
            <Text style={{ fontSize: 11, fontWeight: "700", color: active ? accent.primarySolid : colors.textSecondary }}>{TAB_LABELS[t]}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

export function QuickAddSavedMealRow({
  meal,
  summary,
  slotLabel,
  summaryLabel,
  pending,
  colors,
  accent,
  cardElevation,
  onLog,
  onOpenActions,
}: {
  meal: SavedMeal;
  summary: { itemCount: number; totalCalories: number; totalProtein: number; totalCarbs: number; totalFat: number };
  slotLabel: string;
  summaryLabel: string;
  pending: boolean;
  colors: { card: string; border: string; text: string; textSecondary: string };
  accent: { primary: string };
  cardElevation: { liftBg?: string; useBorder: boolean; shadowStyle?: ViewStyle };
  onLog: () => void;
  onOpenActions: () => void;
}) {
  const itemsLabel = summary.itemCount === 1 ? "1 item" : `${summary.itemCount} items`;
  const dominantSource = dominantSavedMealSource(meal);
  return (
    <PressableScale
      haptic="confirm"
      onPress={onLog}
      onLongPress={onOpenActions}
      disabled={pending || summary.itemCount === 0}
      accessibilityRole="button"
      accessibilityLabel={`Log ${meal.name} to ${slotLabel}. ${summaryLabel}. Long-press for more actions.`}
      style={{
        backgroundColor: cardElevation.liftBg ?? colors.card,
        borderRadius: Radius.xl,
        padding: Spacing.md,
        flexDirection: "row",
        alignItems: "center",
        borderWidth: cardElevation.useBorder ? 1 : 0,
        borderColor: colors.border,
        opacity: pending ? 0.6 : 1,
        ...(cardElevation.shadowStyle ?? {}),
      }}
    >
      <SourceDot source={dominantSource} size={6} style={{ marginRight: 8 }} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "600", color: colors.text }}>{meal.name}</Text>
        <Text style={{ ...Type.captionSmall, color: colors.textSecondary, marginTop: 0 }}>
          {itemsLabel} · {formatMacroTrailer({ calories: summary.totalCalories, protein: summary.totalProtein, carbs: summary.totalCarbs, fat: summary.totalFat })}
        </Text>
      </View>
      <PressableScale haptic="selection" onPress={(e) => { e.stopPropagation?.(); onOpenActions(); }} hitSlop={12} accessibilityRole="button" accessibilityLabel={`More actions for ${meal.name}`} style={{ paddingHorizontal: 4 }}>
        <MoreVertical size={IconSize.lg} color={colors.textSecondary} strokeWidth={2.25} />
      </PressableScale>
      <PlusCircle size={IconSize.hero} color={accent.primary} strokeWidth={2.25} />
    </PressableScale>
  );
}

export function QuickAddHistoryRow({
  row,
  idx,
  activeSlot,
  starred,
  pending,
  colors,
  accent,
  cardElevation,
  onLog,
  onToggleFavorite,
}: {
  row: Row;
  idx: number;
  activeSlot: string;
  starred: boolean;
  pending: boolean;
  colors: { card: string; border: string; text: string; textSecondary: string };
  accent: { primary: string };
  cardElevation: { liftBg?: string; useBorder: boolean; shadowStyle?: ViewStyle };
  onLog: () => void;
  onToggleFavorite: () => void;
}) {
  const isAi = isAiSourcedFoodHistoryItem(row);
  const sourceKey = mapMealSourceToDot(row.source ?? null);
  return (
    <PressableScale
      key={`${row.recipeTitle}-${row.calories}-${idx}`}
      haptic="confirm"
      style={{ backgroundColor: cardElevation.liftBg ?? colors.card, borderRadius: Radius.xl, padding: Spacing.md, flexDirection: "row", alignItems: "center", borderWidth: cardElevation.useBorder ? 1 : 0, borderColor: colors.border, ...(cardElevation.shadowStyle ?? {}) }}
      accessibilityRole="button"
      accessibilityLabel={`Log ${row.recipeTitle} to ${activeSlot}`}
      onPress={onLog}
    >
      <SourceDot source={sourceKey} size={6} style={{ marginRight: 8 }} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
          <Text style={{ fontSize: 15, fontWeight: "600", color: colors.text }}>{row.recipeTitle}</Text>
          {isAi ? <Badge variant="ai" accessibilityLabel="AI estimated nutrition">AI</Badge> : null}
        </View>
        <Text style={{ ...Type.captionSmall, color: colors.textSecondary, marginTop: 0 }}>
          {formatMacroTrailer({ calories: row.calories, protein: row.protein, carbs: row.carbs, fat: row.fat })}
          {row.count > 1 ? `  ·  ${row.count}×` : ""}
        </Text>
      </View>
      <PressableScale haptic="selection" onPress={(e) => { e.stopPropagation?.(); onToggleFavorite(); }} hitSlop={12} accessibilityRole="button" accessibilityLabel={starred ? "Unstar meal" : "Favourite this meal"} accessibilityState={{ selected: starred, disabled: pending }} style={{ paddingHorizontal: 4, opacity: pending ? 0.5 : 1 }}>
        <StarIcon size={22} color={starred ? Accent.warning : colors.textSecondary} fill={starred ? Accent.warning : "transparent"} strokeWidth={2.25} />
      </PressableScale>
      <PlusCircle size={IconSize.hero} color={accent.primary} strokeWidth={2.25} />
    </PressableScale>
  );
}
