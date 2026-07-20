/**
 * LogSheet browse/library rows — extracted from `LogSheet.tsx`
 * (ENG-1448 PR 1; the 400-line discipline says every touch shrinks the
 * legacy file). Web parity: `src/app/components/suppr/log-sheet-rows.tsx`.
 *
 * `slotName` is the active meal slot from the host's ENG-773 slot
 * selector — it feeds the thumb's slot tier so an unmatched title gets
 * an honest slot glyph instead of a generic one (never a wrong food
 * image; see `foodFallbackCategory.ts`).
 */
import { StyleSheet, Text, View } from "react-native";
import { Plus } from "lucide-react-native";
import { FoodFallbackThumb } from "@/components/imagery/FoodFallbackThumb";
import { PressableScale } from "@/components/ui/PressableScale";
import { Accent, Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { isFeatureEnabled } from "@/lib/analytics";
import { type SourceDotSource } from "@/components/ui/SourceDot";
import type { LogSheetLibraryRecipe } from "./LogSheet";

export function LibraryRow({
  recipe,
  onPick,
  slotName,
}: {
  recipe: LogSheetLibraryRecipe;
  onPick: () => void;
  slotName?: string | null;
}) {
  const colors = useThemeColors();
  // ENG-1611 — foods/ingredients render as text: no glyph/photo tiles on
  // log-sheet rows (whole sheet converges on the search-row grammar).
  const textRows = isFeatureEnabled("ingredient_text_rows_v1");
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`Log ${recipe.title}`}
      haptic="confirm"
      onPress={onPick}
      style={styles.resultRow}
    >
      {textRows ? null : (
      <FoodFallbackThumb
        title={recipe.title}
        slot={slotName}
        imageUrl={recipe.thumbnail}
        size={44}
        style={styles.resultThumb}
      />
      )}
      <View style={{ flex: 1, marginLeft: textRows ? 0 : Spacing.sm, minWidth: 0 }}>
        <Text style={[Type.body, { color: colors.text }]} numberOfLines={1}>
          {recipe.title}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: Spacing.xs }}>
          <Text
            style={[
              Type.caption,
              { color: colors.textSecondary, fontVariant: ["tabular-nums"] },
            ]}
          >
            {recipe.kcalPerPortion} kcal
          </Text>
          {recipe.mealTag ? (
            <View
              style={[
                styles.libraryMealTag,
                { backgroundColor: colors.inputBg, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.libraryMealTagText, { color: colors.textSecondary }]}>
                {recipe.mealTag}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </PressableScale>
  );
}

export function BrowseRow({
  title,
  kcal,
  source,
  onPick,
  accessibilityLabel,
  subtitle,
  slotName,
}: {
  title: string;
  kcal: number;
  source: SourceDotSource;
  onPick: () => void;
  /** ENG-783 — optional override (e.g. "Edit portion for X" when the
   *  tap opens the portion editor rather than logging instantly). */
  accessibilityLabel?: string;
  /** Optional portion line (e.g. "100 g · 57 kcal") — Figma 336:2. */
  subtitle?: string;
  slotName?: string | null;
}) {
  const colors = useThemeColors();
  // ENG-1611 — text-only food rows (see LibraryRow note).
  const textRows = isFeatureEnabled("ingredient_text_rows_v1");
  return (
    <View
      style={[styles.resultRow, { borderBottomColor: colors.border }]}
      accessibilityRole="none"
    >
      {textRows ? null : (
      <FoodFallbackThumb
        title={title}
        slot={slotName}
        size={44}
        style={[styles.resultThumb, { borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth }]}
      />
      )}
      <View style={{ flex: 1, marginLeft: textRows ? 0 : Spacing.sm, minWidth: 0 }}>
        <Text style={[Type.body, { color: colors.text, fontSize: 15 }]} numberOfLines={1}>
          {title}
        </Text>
        <Text
          style={[
            Type.caption,
            {
              color: textRows ? colors.textSecondary : colors.textTertiary,
              marginTop: Spacing.xs,
              fontVariant: ["tabular-nums"],
            },
          ]}
          numberOfLines={1}
        >
          {subtitle ?? `${kcal} kcal`}
        </Text>
      </View>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? `Log ${title}`}
        haptic="confirm"
        onPress={onPick}
        style={[
          styles.addCircleBtn,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Plus size={16} color={Accent.carbs} strokeWidth={2.5} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.dense,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  resultThumb: {
    width: 44,
    height: 44,
    borderRadius: Radius.xl,
  },
  addCircleBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  libraryMealTag: {
    marginLeft: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  libraryMealTagText: {
    fontSize: 10,
    fontWeight: "600",
  },
});
