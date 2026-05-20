import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import * as Haptics from "expo-haptics";

import { Accent, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * `<SubTabPill>` — sub-tab navigation inside a primary tab group.
 *
 * 2026-05-19: Replaced the segmented "pill in a grey track" control
 * (read as tacky on cream backgrounds) with an underline tab bar —
 * text labels + a 2px active indicator, no floating white chips or
 * track shadows.
 *
 * Web mirror: `src/app/components/ui/sub-tab-pill.tsx`.
 */
export type SubTabItem<TId extends string = string> = {
  id: TId;
  label: string;
  badge?: number;
  accessibilityLabel?: string;
};

export interface SubTabPillProps<TId extends string = string> {
  items: readonly SubTabItem<TId>[];
  activeId: TId;
  onSelect: (id: TId) => void;
  accessibilityLabel: string;
  scrollable?: boolean;
  /** Nested under a screen chrome header — tighter vertical padding. */
  embedded?: boolean;
}

export function SubTabPill<TId extends string>({
  items,
  activeId,
  onSelect,
  accessibilityLabel,
  scrollable = false,
  embedded = false,
}: SubTabPillProps<TId>) {
  const colors = useThemeColors();

  const handleSelect = (id: TId) => {
    if (id === activeId) return;
    if (process.env.EXPO_OS === "ios") {
      void Haptics.selectionAsync();
    }
    onSelect(id);
  };

  const Row = (
    <View
      style={{
        flexDirection: "row",
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        flex: scrollable ? 1 : undefined,
      }}
    >
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <Pressable
            key={item.id}
            onPress={() => handleSelect(item.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={item.accessibilityLabel ?? item.label}
            testID={`subtab-${item.id}`}
            style={{
              flex: scrollable ? undefined : 1,
              minWidth: scrollable ? 96 : undefined,
              paddingVertical: Spacing.md,
              paddingHorizontal: scrollable ? Spacing.md : Spacing.sm,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 6,
              borderBottomWidth: 2,
              marginBottom: -1,
              borderBottomColor: active ? colors.text : "transparent",
            }}
          >
            <Text
              style={{
                fontSize: 15,
                fontWeight: active ? "700" : "500",
                color: active ? colors.text : colors.textSecondary,
                letterSpacing: active ? -0.2 : 0,
              }}
            >
              {item.label}
            </Text>
            {item.badge !== undefined && item.badge > 0 ? (
              <View
                style={{
                  minWidth: 20,
                  height: 18,
                  paddingHorizontal: 5,
                  borderRadius: 9,
                  backgroundColor: active ? colors.text : colors.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "700",
                    color: active ? "#fff" : colors.textSecondary,
                  }}
                >
                  {item.badge > 999 ? "999+" : item.badge}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={{
        paddingHorizontal: Spacing.xl,
        paddingTop: embedded ? 0 : Spacing.sm,
        paddingBottom: embedded ? Spacing.md : Spacing.lg,
        backgroundColor: colors.background,
      }}
    >
      {scrollable ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {Row}
        </ScrollView>
      ) : (
        Row
      )}
    </View>
  );
}

export default SubTabPill;
