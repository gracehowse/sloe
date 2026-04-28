import React from "react";
import { Pressable, Text, View } from "react-native";
import * as Haptics from "expo-haptics";

import { Accent, Radius, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * PlanSubTabHeader — segmented sub-tab pill bar shown at the top of
 * the Plan tab to flip between the weekly Plan and Shopping list
 * sub-views once the 6→4 tab collapse landed (Phase 2 / B1.1,
 * 2026-04-27 strategic spec).
 *
 * Per D-2026-04-27-02:
 *   "Plan (planner + shopping list as sub-view)"
 * and the production design spec, Surface D:
 *   "Plan is sit-down. Shopping is supermarket-phone."
 *
 * Unlike the Recipes / You sub-tab headers (which switch between
 * separate route files via `router.replace`), Shopping is rendered
 * inline within the existing planner screen via a state toggle, so
 * this header is purely a visual segmented control whose `value` and
 * `onChange` are owned by the planner host. We intentionally mirror
 * the web mobile `<MealPlanner>` pattern (Plan / Shop pill bar from
 * `src/app/App.tsx`) for cross-platform parity.
 */
export type PlanSubTab = "plan" | "shopping";

export interface PlanSubTabHeaderProps {
  value: PlanSubTab;
  onChange: (next: PlanSubTab) => void;
  shoppingUncheckedCount?: number;
}

export function PlanSubTabHeader({ value, onChange, shoppingUncheckedCount = 0 }: PlanSubTabHeaderProps) {
  const colors = useThemeColors();

  const handleSelect = (target: PlanSubTab) => {
    if (target === value) return;
    if (process.env.EXPO_OS === "ios") {
      void Haptics.selectionAsync();
    }
    onChange(target);
  };

  return (
    <View
      style={{
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.sm,
        paddingBottom: Spacing.sm,
        backgroundColor: colors.background,
      }}
      accessibilityRole="tablist"
      accessibilityLabel="Plan sections"
    >
      <View
        style={{
          flexDirection: "row",
          backgroundColor: colors.cardBorder,
          borderRadius: Radius.md,
          padding: 4,
          gap: 4,
        }}
      >
        <SubTabPill
          label="This week"
          active={value === "plan"}
          onPress={() => handleSelect("plan")}
          activeBg={colors.card}
          activeText={Accent.primary}
          inactiveText={colors.textSecondary}
        />
        <SubTabPill
          label="Shopping"
          active={value === "shopping"}
          onPress={() => handleSelect("shopping")}
          activeBg={colors.card}
          activeText={Accent.primary}
          inactiveText={colors.textSecondary}
          badge={shoppingUncheckedCount > 0 ? shoppingUncheckedCount : undefined}
        />
      </View>
    </View>
  );
}

interface SubTabPillProps {
  label: string;
  active: boolean;
  onPress: () => void;
  activeBg: string;
  activeText: string;
  inactiveText: string;
  badge?: number;
}

function SubTabPill({ label, active, onPress, activeBg, activeText, inactiveText, badge }: SubTabPillProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={{
        flex: 1,
        paddingVertical: 10,
        borderRadius: Radius.sm,
        backgroundColor: active ? activeBg : "transparent",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 6,
      }}
    >
      <Text
        style={{
          fontSize: 14,
          fontWeight: active ? "700" : "600",
          color: active ? activeText : inactiveText,
        }}
      >
        {label}
      </Text>
      {badge !== undefined ? (
        <View
          style={{
            minWidth: 18,
            height: 18,
            paddingHorizontal: 5,
            borderRadius: 9,
            backgroundColor: Accent.primary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: "700", color: "#fff" }}>
            {badge > 99 ? "99+" : badge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export default PlanSubTabHeader;
