import React from "react";
import { ScrollView, Text, View } from "react-native";

import { Spacing, Type } from "@/constants/theme";
import { PressableScale } from "@/components/ui/PressableScale";
import { CountBadge } from "@/components/ui/CountBadge";
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
          <PressableScale
            key={item.id}
            haptic={active ? "none" : "selection"}
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
              gap: Spacing.sm,
              borderBottomWidth: 2,
              marginBottom: -1,
              borderBottomColor: active ? colors.text : "transparent",
            }}
          >
            <Text
              style={{
                fontFamily: Type.bodyLarge.fontFamily,
                fontSize: Type.bodyLarge.fontSize,
                lineHeight: Type.bodyLarge.lineHeight,
                fontWeight: active ? "700" : "500",
                color: active ? colors.text : colors.textSecondary,
                letterSpacing: active ? -0.2 : 0,
              }}
            >
              {item.label}
            </Text>
            {item.badge !== undefined && item.badge > 0 ? (
              <CountBadge count={item.badge} active={active} />
            ) : null}
          </PressableScale>
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
