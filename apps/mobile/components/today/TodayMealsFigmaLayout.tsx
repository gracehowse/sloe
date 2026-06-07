import React, { type ReactNode } from "react";
import { Image, Pressable, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import type { JournalMeal } from "@/lib/nutritionJournal";
import { mealRowImageUrl } from "@suppr/shared/nutrition/foodHistory";
import {
  nextUnloggedMealSlot,
  TODAY_MEAL_SLOT_ORDER,
} from "@suppr/shared/copy/today";
import { SupprCard } from "@/components/ui/SupprCard";
import { Accent, Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/** Sloe stroke check — Figma `654:2` Logged badge. */
function SloeCheckIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 6 9 17l-5-5"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Sloe stroke plus — Figma `654:2` Log {slot} CTA. */
function SloePlusIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12h14" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M12 5v14" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export interface TodayMealsFigmaLayoutProps {
  mealGroups: Record<string, JournalMeal[]>;
  collapsedSlots: Set<string>;
  onToggleSlotCollapse: (slot: string) => void;
  onOpenFabForSlot: (slot: string) => void;
  renderSlotExpanded?: (slot: string, meals: JournalMeal[]) => ReactNode;
}

/** Figma `654:2` Today's Meals summary cards — parity with web. */
export function TodayMealsFigmaLayout({
  mealGroups,
  collapsedSlots,
  onToggleSlotCollapse,
  onOpenFabForSlot,
  renderSlotExpanded,
}: TodayMealsFigmaLayoutProps) {
  const colors = useThemeColors();

  const totalKcal = Math.round(
    TODAY_MEAL_SLOT_ORDER.reduce((sum, slot) => {
      const meals = mealGroups[slot] ?? [];
      return sum + meals.reduce((s, m) => s + m.calories, 0);
    }, 0),
  );

  const loggedSlots = TODAY_MEAL_SLOT_ORDER.filter(
    (slot) => (mealGroups[slot] ?? []).length > 0,
  );
  const nextSlot = nextUnloggedMealSlot(loggedSlots);

  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: Spacing.md,
        }}
        testID="today-meals-figma-header"
      >
        <Text style={{ ...Type.title, color: colors.navPrimary }}>
          Today&apos;s Meals
        </Text>
        {totalKcal > 0 ? (
          <Text
            style={{ ...Type.caption, color: colors.textTertiary }}
            testID="today-meals-kcal-total"
          >
            {totalKcal.toLocaleString()} kcal total
          </Text>
        ) : null}
      </View>

      <View style={{ gap: 12 }} testID="today-meals-figma-list">
        {TODAY_MEAL_SLOT_ORDER.map((slot) => {
          const meals = mealGroups[slot] ?? [];
          if (meals.length === 0) return null;

          const slotCals = Math.round(
            meals.reduce((s, m) => s + m.calories, 0),
          );
          const slotProtein = Math.round(
            meals.reduce((s, m) => s + (m.protein ?? 0), 0),
          );
          const primary = meals[0];
          const thumbUrl = mealRowImageUrl(primary);
          const isOpen = !collapsedSlots.has(slot);

          return (
            <SupprCard
              key={slot}
              lift="flat"
              padding="none"
              testID={`today-meals-figma-card-${slot}`}
            >
              <Pressable
                onPress={() => onToggleSlotCollapse(slot)}
                accessibilityRole="button"
                accessibilityLabel={`${slot}, ${meals.length} items`}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 16,
                  padding: 12,
                }}
              >
                {thumbUrl ? (
                  <Image
                    source={{ uri: thumbUrl }}
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: Radius.md,
                    }}
                  />
                ) : (
                  <View
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: Radius.md,
                      backgroundColor: colors.textTertiary + "20",
                    }}
                  />
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 4,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "500",
                        letterSpacing: 0.6,
                        textTransform: "uppercase",
                        color: colors.textSecondary,
                      }}
                    >
                      {slot}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <SloeCheckIcon size={14} color={colors.textTertiary} />
                      <Text style={{ ...Type.caption, color: colors.textTertiary }}>
                        Logged
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={{
                      ...Type.headline,
                      color: colors.text,
                    }}
                    numberOfLines={1}
                  >
                    {primary.recipeTitle}
                  </Text>
                  <Text
                    style={{
                      ...Type.caption,
                      color: colors.textSecondary,
                      marginTop: 2,
                    }}
                  >
                    {slotCals.toLocaleString()} kcal • {slotProtein}g P
                  </Text>
                </View>
              </Pressable>
              {isOpen && renderSlotExpanded
                ? renderSlotExpanded(slot, meals)
                : null}
            </SupprCard>
          );
        })}

        {nextSlot ? (
          <Pressable
            onPress={() => onOpenFabForSlot(nextSlot)}
            accessibilityRole="button"
            accessibilityLabel={`Log ${nextSlot}`}
            testID={`today-log-slot-cta-${nextSlot}`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: 16,
              borderRadius: Radius.lg,
              borderWidth: 1,
              borderStyle: "dashed",
              borderColor: colors.textTertiary + "60",
            }}
          >
            <SloePlusIcon size={20} color={Accent.primary} />
            <Text style={{ ...Type.body, fontWeight: "500", color: colors.textSecondary }}>
              Log {nextSlot}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
