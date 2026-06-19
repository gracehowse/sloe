/**
 * ENG-1100 — shared empty meal-slot UI for Today + Plan (mobile).
 *
 * Mirror: `src/app/components/suppr/empty-meal-slot-row.tsx` (web).
 */
import { Text, type TextStyle } from "react-native";
import { aimKcalLabel } from "@suppr/shared/nutrition/mealSlotAim";
import { Type } from "@/constants/theme";

export type EmptyMealSlotSurface = "today" | "plan";

export type EmptyMealSlotAimLineProps = {
  slot: string;
  aimKcal: number;
  surface: EmptyMealSlotSurface;
  /** Today uses secondary foreground; Plan uses meal macro line styling. */
  variant?: "today" | "plan";
  color?: string;
  style?: TextStyle;
};

/** Renders "Aim ~X kcal" with the stable per-surface test ID. */
export function EmptyMealSlotAimLine({
  slot,
  aimKcal,
  surface,
  variant = surface,
  color,
  style,
}: EmptyMealSlotAimLineProps) {
  const testID = surface === "today" ? `today-slot-aim-${slot}` : `plan-slot-aim-${slot}`;
  return (
    <Text
      testID={testID}
      style={[
        variant === "today" ? { ...Type.caption, marginTop: 1 } : Type.caption,
        { fontVariant: ["tabular-nums"], color },
        style,
      ]}
      numberOfLines={1}
    >
      {aimKcalLabel(aimKcal)}
    </Text>
  );
}
