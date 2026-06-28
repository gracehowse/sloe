import React, { memo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Camera, Clock, Plus, ScanBarcode, Sparkles, type LucideIcon } from "lucide-react-native";

import { IconSize, Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import type { FoodHistoryItem } from "@suppr/shared/nutrition/foodHistory";

/** Source → chip glyph (prototype `srcChip` map): a barcode/photo/AI item reads
 *  as such; plain recents use the clock. */
function sourceIcon(source?: string): LucideIcon {
  const s = (source ?? "").toLowerCase();
  if (s.includes("barcode") || s.includes("scan")) return ScanBarcode;
  if (s.includes("photo") || s.includes("image") || s.includes("camera")) return Camera;
  if (s.includes("ai") || s.includes("voice") || s.includes("gpt")) return Sparkles;
  return Clock;
}

export interface TodayRecentsRowProps {
  recents: FoodHistoryItem[];
  /** One-tap re-log a recent food into the active slot. */
  onReLog: (item: FoodHistoryItem) => void;
  /** "All" link + empty-state prompt → open the full LogSheet. */
  onOpenAll: () => void;
}

/**
 * Today "Quick add" recents row (ENG-1247, v3 prototype `.quickrow`). One-tap
 * re-log chips of the user's most-recent foods — the daily loop is mostly repeat
 * eating, so recents beat method-launchers for speed-to-value (product-lead
 * 2026-06-28). The method-launchers (Search/Voice/Snap/Scan) live in the
 * FAB→LogSheet, reachable via the "All" link. Flag-gated by the host
 * (`today_quickadd_recents_v3`).
 */
function TodayRecentsRowImpl({ recents, onReLog, onOpenAll }: TodayRecentsRowProps) {
  const colors = useThemeColors();
  const items = recents.slice(0, 6);
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={[Type.headline, { color: colors.text }]}>Quick add</Text>
        <Pressable
          onPress={onOpenAll}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="All logging options"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Text style={[Type.caption, { color: colors.navPrimary, fontWeight: "600" }]}>All</Text>
        </Pressable>
      </View>
      {items.length === 0 ? (
        <Pressable
          testID="today-recents-empty"
          onPress={onOpenAll}
          accessibilityRole="button"
          accessibilityLabel="Log your first meal"
          style={({ pressed }) => [
            styles.empty,
            { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Plus size={IconSize.base} color={colors.textSecondary} />
          <Text style={[Type.body, { color: colors.textSecondary }]}>Log your first meal</Text>
        </Pressable>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          {items.map((item, i) => {
            const Icon = sourceIcon(item.source);
            const name =
              item.recipeTitle.length > 15 ? `${item.recipeTitle.slice(0, 15)}…` : item.recipeTitle;
            return (
              <Pressable
                key={`${item.recipeTitle}-${i}`}
                testID={`today-recent-chip-${i}`}
                onPress={() => onReLog(item)}
                accessibilityRole="button"
                accessibilityLabel={`Log ${item.recipeTitle}, ${Math.round(item.calories)} calories`}
                style={({ pressed }) => [
                  styles.chip,
                  { backgroundColor: colors.backgroundSecondary, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Icon size={IconSize.md} color={colors.textTertiary} />
                <Text style={[Type.caption, { color: colors.text }]} numberOfLines={1}>
                  {name}
                </Text>
                <Text style={[Type.caption, styles.kcal, { color: colors.text }]}>
                  {Math.round(item.calories)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: Spacing.lg },
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  row: { gap: Spacing.xs, paddingRight: Spacing.lg },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    height: 36,
    borderRadius: Radius.full,
  },
  kcal: { fontWeight: "700", fontVariant: ["tabular-nums"] },
  empty: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    height: 44,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
});

export const TodayRecentsRow = memo(TodayRecentsRowImpl);
