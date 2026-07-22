/**
 * FoodSearchFeedItem — one row of the redesigned (ENG-814) sectioned
 * search-results feed, extracted from `FoodSearchPanel.tsx` (which is pinned
 * by the screen-line ratchet and may only shrink).
 *
 * ENG-1532 (component grammar dedup) — the feed renders ONE of two row
 * grammars, gated by `component_grammar_dedup`:
 *
 *   flag ON  → PLAIN ROWS with the exact skeleton of the "Past logged" /
 *              "Favourites" history rows (title line with the inline
 *              confidence chip, unified kcal-leads-basis-trails sub-line via
 *              the shared `formatFoodSearchRowSubline`, hairline separators,
 *              right-side `›` chevron). The big right-aligned KCAL display
 *              numeral dies — it invited misreading per-100g values as
 *              per-serving (Fable ruling 2026-07-16).
 *   flag OFF → today's soft-elevated grouped CARD render, byte-intact (the
 *              PostHog kill switch). Keep in sync with the web sibling
 *              `src/app/components/food-search/FoodSearchResultRow.tsx`.
 *
 * Section overlines ("Best matches" / "More results") render identically on
 * both paths.
 */
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { ChevronRight } from "lucide-react-native";

import { Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useCardElevation } from "@/hooks/useCardElevation";
import { isFeatureEnabled } from "@/lib/analytics";
import {
  resolveFoodSearchHeadline,
  FOOD_SEARCH_PER_SERVING_BADGE,
  FOOD_SEARCH_PER_100G_BADGE,
} from "@suppr/nutrition-core/foodSearchHeadline";
import { formatFoodSearchRowSubline } from "@suppr/nutrition-core/foodSearchRowSubline";
import { foodSearchSourceLabel } from "@suppr/nutrition-core/foodSearchMerge";
import {
  isLearnedCustomFoodSource,
  LEARNED_CUSTOM_FOOD_REUSE_CUE,
  type CustomFood,
} from "@suppr/nutrition-core/customFoods";
import Badge from "../Badge";
import { SearchResultConfidenceChip } from "../ui/SearchResultConfidenceChip";
import type { RenderRow, SearchRow } from "./FoodSearchPanel";

/** The macro-colour trio the panel resolves per scheme (ENG-1223). */
export type FeedMacroColors = { protein: string; carbs: string; fat: string };

/** Subset of the panel's StyleSheet the card row reads. */
export type FeedItemStyles = {
  resultName: TextStyle;
  macroPreview: ViewStyle;
  macroPreviewText: TextStyle;
  perLabel: TextStyle;
  per100g: TextStyle;
};

export type FoodSearchFeedItemProps = {
  item: RenderRow;
  loadingKey: string | null;
  mc: FeedMacroColors;
  styles: FeedItemStyles;
  onPickResult: (row: SearchRow) => void;
  onLongPressCustom: (food: CustomFood) => void;
};

export function FoodSearchFeedItem({
  item,
  loadingKey,
  mc,
  styles,
  onPickResult,
  onLongPressCustom,
}: FoodSearchFeedItemProps) {
  const colors = useThemeColors();
  const accent = useAccent();
  const cardElevation = useCardElevation();
  // ENG-1532 — component grammar dedup. ON → the unified plain-row grammar;
  // OFF → the ENG-814 grouped-card render below, byte-intact (kill switch).
  const grammarDedup = isFeatureEnabled("component_grammar_dedup");
  // ENG-1002/type_scale_v1 — whole-app font-family + size consistency gate.
  const typeScaleV1 = isFeatureEnabled("type_scale_v1");

  if (item.kind === "header") {
    return (
      <Text
        testID={`food-search-section-${item.label === "Best matches" ? "best" : "more"}`}
        style={{
          ...(typeScaleV1
            ? { ...Type.label, color: colors.textTertiary }
            : {
                fontSize: 11,
                fontWeight: "800",
                letterSpacing: 0.6,
                color: colors.textTertiary,
                textTransform: "uppercase",
              }),
          marginTop: Spacing.md,
          marginBottom: Spacing.sm,
          // Mirrors the pre-extraction 2px optical inset (half the xs step —
          // derived from the token, not an ad-hoc literal).
          marginHorizontal: Spacing.xs / 2,
        }}
      >
        {item.label}
      </Text>
    );
  }

  const row = item.row;
  const isLoading = loadingKey === row.key;
  const isCustom = row._source === "CUSTOM";
  const customFood = isCustom ? row._custom : null;
  const headline = resolveFoodSearchHeadline(row);
  const primary = row.primaryServing ?? null;
  const accessibilityLabel = isCustom
    ? `Custom food: ${row.name}. Long-press for edit or delete.`
    : primary
      ? `${row.name}. ${primary.kcal} kcal per ${primary.label}, ${primary.grams} grams.`
      : row.name;
  // The legible confidence chip stays the canonical shared
  // `<SearchResultConfidenceChip>` (also barcode + voice-log) so the chip
  // language can't drift between logging entry points. A defensively-absent
  // tier falls back to the CONSERVATIVE "Estimated" — never "Verified"
  // (CLAUDE.md trust posture; matches the web sibling ENG-815).
  const chipTier = row.confidenceTier === "verified" ? "verified" : "estimated";
  const sourceLabel = foodSearchSourceLabel(row._source);

  if (grammarDedup) {
    // ── Flag ON — unified plain row (the Past-logged skeleton) ──────────
    const subline = formatFoodSearchRowSubline(
      headline,
      foodSearchSourceLabel(row._source),
    );
    return (
      <Pressable
        key={row.key}
        testID={`search-row-${row.key}`}
        onPress={() => onPickResult(row)}
        onLongPress={
          isCustom && customFood ? () => onLongPressCustom(customFood) : undefined
        }
        disabled={isLoading}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: Spacing.dense,
          borderBottomWidth: item.isLast ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: Spacing.sm,
              flexWrap: "wrap",
            }}
          >
            <Text
              style={{ fontSize: 15, fontWeight: "600", color: colors.text }}
              numberOfLines={1}
            >
              {row.name}
            </Text>
            {isCustom ? (
              <Badge variant="custom">Custom</Badge>
            ) : (
              <SearchResultConfidenceChip tier={chipTier} sourceLabel={sourceLabel} />
            )}
          </View>
          <Text
            style={{
              ...Type.captionSmall,
              color: colors.textSecondary,
              // Mirrors the Past-logged rows' 2px baseline offset (half the
              // xs step — derived from the token, not an ad-hoc literal).
              marginTop: Spacing.xs / 2,
              fontVariant: ["tabular-nums"],
            }}
            numberOfLines={1}
          >
            {subline ?? "Tap for nutrition info"}
          </Text>
          {customFood && isLearnedCustomFoodSource(customFood.source) ? (
            <Text
              testID="learned-custom-food-cue"
              style={{
                fontSize: 11,
                fontStyle: "italic",
                color: colors.textSecondary,
                marginTop: Spacing.xs / 2,
              }}
            >
              {LEARNED_CUSTOM_FOOD_REUSE_CUE}
            </Text>
          ) : null}
        </View>
        {isLoading ? (
          <ActivityIndicator size="small" color={accent.primary} />
        ) : (
          <Text
            style={{ fontSize: 13, color: colors.textTertiary, marginLeft: Spacing.sm }}
          >
            ›
          </Text>
        )}
      </Pressable>
    );
  }

  // ── Flag OFF — the ENG-814 grouped-card row, byte-intact ──────────────
  // Same tap target + a11y as the flat row, but framed inside a
  // soft-elevated card with the confidence chip on the topline and a faint
  // inset seam between rows (not a hairline divider). `isFirst` suppresses
  // the seam on the first row of a card. The shadow lives on the same View
  // as the row content (no `overflow: hidden`, so iOS shadows are not
  // clipped); corner radius is applied per card-position so the section
  // reads as a single card. Dark mode uses the tonal lift + hairline (per
  // `useCardElevation`); light mode uses the soft shadow.
  return (
    <View
      style={[
        {
          backgroundColor: cardElevation.liftBg ?? colors.card,
          borderTopLeftRadius: item.isFirst ? Radius.lg : 0,
          borderTopRightRadius: item.isFirst ? Radius.lg : 0,
          borderBottomLeftRadius: item.isLast ? Radius.lg : 0,
          borderBottomRightRadius: item.isLast ? Radius.lg : 0,
          borderLeftWidth: cardElevation.useBorder ? StyleSheet.hairlineWidth : 0,
          borderRightWidth: cardElevation.useBorder ? StyleSheet.hairlineWidth : 0,
          borderTopWidth: cardElevation.useBorder && item.isFirst ? StyleSheet.hairlineWidth : 0,
          borderBottomWidth: cardElevation.useBorder && item.isLast ? StyleSheet.hairlineWidth : 0,
          borderColor: colors.cardBorder,
        },
        // Apply the soft shadow only on the first row of a card; a single
        // shadow on the top row reads as the card's lift without stacking
        // four overlapping shadows down the group.
        item.isFirst ? cardElevation.shadowStyle : undefined,
      ]}
    >
      <Pressable
        key={row.key}
        onPress={() => onPickResult(row)}
        onLongPress={
          isCustom && customFood ? () => onLongPressCustom(customFood) : undefined
        }
        disabled={isLoading}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: Spacing.md,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.md,
          borderTopWidth: item.isFirst ? 0 : StyleSheet.hairlineWidth,
          borderTopColor: colors.cardBorder,
          backgroundColor: pressed ? colors.background : "transparent",
        })}
      >
        <View style={{ flex: 1 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: Spacing.sm,
              flexWrap: "wrap",
            }}
          >
            {isCustom && <Badge variant="custom">Custom</Badge>}
            <SearchResultConfidenceChip tier={chipTier} sourceLabel={sourceLabel} />
            <Text style={styles.resultName} numberOfLines={2}>
              {row.name}
            </Text>
          </View>
          {headline.mode === "per-serving" ? (
            <>
              <View style={styles.macroPreview}>
                <Text style={[styles.macroPreviewText, { color: mc.protein }]}>P {headline.macros.protein}g</Text>
                <Text style={[styles.macroPreviewText, { color: mc.carbs }]}>C {headline.macros.carbs}g</Text>
                <Text style={[styles.macroPreviewText, { color: mc.fat }]}>F {headline.macros.fat}g</Text>
              </View>
              <Text style={styles.perLabel}>{FOOD_SEARCH_PER_SERVING_BADGE}</Text>
              <Text style={styles.per100g}>
                {headline.servingLabel}
                {headline.per100gReference ? ` · ${headline.per100gReference}` : ""}
              </Text>
            </>
          ) : headline.mode === "per-100g" && headline.macros ? (
            <>
              <View style={styles.macroPreview}>
                <Text style={[styles.macroPreviewText, { color: mc.protein }]}>P {headline.macros.protein}g</Text>
                <Text style={[styles.macroPreviewText, { color: mc.carbs }]}>C {headline.macros.carbs}g</Text>
                <Text style={[styles.macroPreviewText, { color: mc.fat }]}>F {headline.macros.fat}g</Text>
              </View>
              <Text style={styles.per100g}>{FOOD_SEARCH_PER_100G_BADGE}</Text>
            </>
          ) : headline.mode === "per-100g" ? (
            <Text style={styles.per100g}>{FOOD_SEARCH_PER_100G_BADGE}</Text>
          ) : (
            <Text style={styles.per100g}>Tap for nutrition info</Text>
          )}
          {customFood && isLearnedCustomFoodSource(customFood.source) ? (
            <Text
              testID="learned-custom-food-cue"
              style={{
                fontSize: 11,
                fontStyle: "italic",
                color: colors.textSecondary,
                marginTop: Spacing.xs / 2,
              }}
            >
              {LEARNED_CUSTOM_FOOD_REUSE_CUE}
            </Text>
          ) : null}
        </View>
        {headline.mode !== "placeholder" && !isLoading ? (
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text, fontVariant: ["tabular-nums"] }}>
              {headline.headlineKcal}
            </Text>
            <Text style={{ fontSize: 10, fontWeight: "700", color: colors.textTertiary, letterSpacing: 0.4 }}>KCAL</Text>
          </View>
        ) : null}
        {isLoading ? (
          <ActivityIndicator size="small" color={accent.primary} />
        ) : (
          <ChevronRight size={16} color={colors.textTertiary} />
        )}
      </Pressable>
    </View>
  );
}

export default FoodSearchFeedItem;
