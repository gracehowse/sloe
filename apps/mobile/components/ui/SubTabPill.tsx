import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import * as Haptics from "expo-haptics";

import { Accent, Radius, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * `<SubTabPill>` — segmented pill bar primitive for sub-tab navigation
 * inside a primary tab group.
 *
 * Background: the 6→4 tab collapse (Phase 2 / B1.1, 2026-04-27,
 * `D-2026-04-27-02`) folded Library + Discover under "Recipes" and
 * Progress + Settings under "You". Each group needed an in-screen
 * pill bar to flip between sub-tabs without bouncing through the
 * primary tab bar. Three near-identical implementations landed
 * across `RecipesSubTabHeader`, `PlanSubTabHeader`, and
 * `YouSubTabHeader` — each with its own copy of the pill render
 * logic. The teardown's F5 finding (`docs/ux/teardown-2026-04-28-
 * daily-loop.md`) called this out: "the implementation isn't a
 * sub-tab system; it's two custom pill components and listener
 * hacks that defeat the tab framework's defaults". This primitive
 * is the shared foundation that resolves that.
 *
 * Web mirror: `src/app/components/ui/sub-tab-pill.tsx`. Both
 * platforms expose the same prop shape — feed in `items`,
 * `activeId`, `onSelect`, get back a styled pill bar.
 *
 * Usage:
 *   <SubTabPill
 *     items={[
 *       { id: "library", label: "Library" },
 *       { id: "discover", label: "Discover" },
 *     ]}
 *     activeId="library"
 *     onSelect={(id) => router.replace(`/(tabs)/${id}`)}
 *     accessibilityLabel="Recipes sections"
 *   />
 *
 * Re-tapping the active pill is a no-op — `onSelect` only fires for
 * a state change. Selection haptic fires on iOS automatically.
 */
export type SubTabItem<TId extends string = string> = {
  id: TId;
  label: string;
  /** Optional unread / count badge displayed to the right of the
   *  label (e.g. shopping list unchecked-item count on the Plan
   *  tab's "Shopping" pill). Renders only when > 0. */
  badge?: number;
  /** Override the accessibility label. Defaults to the visible
   *  `label` — pass this when the visible label is too short or
   *  carries context that screen-readers need spelled out. */
  accessibilityLabel?: string;
};

export interface SubTabPillProps<TId extends string = string> {
  items: ReadonlyArray<SubTabItem<TId>>;
  activeId: TId;
  onSelect: (id: TId) => void;
  /** Group accessibility label — announced to screen readers as the
   *  tablist context (e.g. "Recipes sections", "Plan sections"). */
  accessibilityLabel: string;
  /** When `true`, wrap the row in a horizontal `ScrollView`. Use for
   *  groups whose pills can't fit on the narrowest viewport (~360pt).
   *  Default `false` — most 2-pill groups fit comfortably. */
  scrollable?: boolean;
}

export function SubTabPill<TId extends string>({
  items,
  activeId,
  onSelect,
  accessibilityLabel,
  scrollable = false,
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
        backgroundColor: colors.cardBorder,
        borderRadius: Radius.md,
        padding: 4,
        gap: 4,
        flex: scrollable ? 1 : undefined,
      }}
    >
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <Pill
            key={item.id}
            label={item.label}
            badge={item.badge}
            active={active}
            scrollable={scrollable}
            accessibilityLabel={item.accessibilityLabel ?? item.label}
            // Stable e2e selector — Maestro flows tap by id rather than
            // by label text, which can be ambiguous across screens.
            // Convention: `subtab-{id}` (e.g. `subtab-discover`).
            testID={`subtab-${item.id}`}
            activeBg={colors.card}
            activeText={Accent.primary}
            inactiveText={colors.textSecondary}
            onPress={() => handleSelect(item.id)}
          />
        );
      })}
    </View>
  );

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={{
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.sm,
        paddingBottom: Spacing.sm,
        backgroundColor: colors.background,
      }}
    >
      {scrollable ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1 }}
        >
          {Row}
        </ScrollView>
      ) : (
        Row
      )}
    </View>
  );
}

interface PillProps {
  label: string;
  badge: number | undefined;
  active: boolean;
  scrollable: boolean;
  accessibilityLabel: string;
  testID: string;
  activeBg: string;
  activeText: string;
  inactiveText: string;
  onPress: () => void;
}

function Pill({
  label,
  badge,
  active,
  scrollable,
  accessibilityLabel,
  testID,
  activeBg,
  activeText,
  inactiveText,
  onPress,
}: PillProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={{
        flex: 1,
        // YouSubTab-style scrollable groups need a min width so 3+
        // pills don't crush each other before the ScrollView kicks
        // in. Non-scrollable groups (the common case) let `flex: 1`
        // do the distribution.
        minWidth: scrollable ? 92 : undefined,
        paddingVertical: 10,
        paddingHorizontal: scrollable ? Spacing.sm : 0,
        borderRadius: Radius.sm,
        backgroundColor: active ? activeBg : "transparent",
        // Audit 2026-04-29 papercut #9 — the active pill's `colors.card`
        // background sits on a `colors.cardBorder` container; in light
        // mode both are near-white, leaving the active state visually
        // soft. A subtle shadow lifts the active pill so the selected
        // state reads cleanly across all surfaces (Library / Discover,
        // Plan / Shopping, Progress / Settings).
        ...(active
          ? {
              shadowColor: "#000",
              shadowOpacity: 0.08,
              shadowRadius: 3,
              shadowOffset: { width: 0, height: 1 },
              elevation: 2,
            }
          : null),
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
      {badge !== undefined && badge > 0 ? (
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

export default SubTabPill;
