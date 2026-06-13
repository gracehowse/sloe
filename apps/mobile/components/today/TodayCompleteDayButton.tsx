import React from "react";
import { Pressable, Text, View } from "react-native";
import { Layout } from "@/constants/layout";
import { Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { dateKeyFromDate } from "@/lib/nutritionJournal";
import { exportDayToHealth, isHealthSyncAvailable } from "@/lib/healthSync";

/**
 * TodayCompleteDayButton — the day's terminal action on the Today scroll.
 *
 * Extracted from `apps/mobile/app/(tabs)/index.tsx` (ENG-1065 / F-158) so the
 * Today screen file moves toward the 400-line target rather than away from it.
 *
 * Sloe treatment system (2026-06-08): primary inline CTA → aubergine OUTLINE
 * (transparent fill + 1.5px `accent.primarySolid` border + primary-solid
 * label), not a filled slab. Mirror of web `NutritionTracker`.
 *
 * F-158 (founder TF57): the button read as "stylistically out of place —
 * floating in dead space" because it was the one scroll-body element that
 * skipped the section grammar — an off-rhythm `marginTop: Spacing.lg` (20)
 * where every sibling section uses `Layout.todaySectionBreak` (32), and no
 * section wrapper. It now sits in a section <View> on the standard 32pt
 * cadence as the final section, so it reads as the day's closing action rather
 * than a stray button. Outline tier + label + behaviour unchanged.
 *
 * Side-effect parity with the old inline handler: on press it opens the
 * Complete-Day modal AND, when the user has opted into HealthKit nutrition
 * export, fires `exportDayToHealth` for the selected day. That mirrors the
 * prior inline behaviour exactly.
 */
export interface TodayCompleteDayButtonProps {
  /** Authenticated user id (null when signed-out / not yet hydrated). */
  userId: string | null;
  /** The day currently in view on Today. */
  selectedDate: Date;
  /** Opens the Complete-Day modal (host owns the modal + its state). */
  onComplete: () => void;
}

export function TodayCompleteDayButton({
  userId,
  selectedDate,
  onComplete,
}: TodayCompleteDayButtonProps) {
  const accent = useAccent();

  return (
    <View style={{ marginTop: Layout.todaySectionBreak }}>
      <Pressable
        onPress={async () => {
          onComplete();
          // Auto-export to HealthKit if the user opted in.
          if (userId && isHealthSyncAvailable()) {
            try {
              const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
              const exp = await AsyncStorage.getItem("health_export_nutrition");
              if (exp === "true") {
                const dk = dateKeyFromDate(selectedDate);
                void exportDayToHealth(userId, dk);
              }
            } catch {}
          }
        }}
        accessibilityRole="button"
        accessibilityLabel="Complete day"
        style={({ pressed }) => ({
          paddingVertical: Spacing.md,
          borderRadius: Radius.md,
          backgroundColor: "transparent",
          borderWidth: 1.5,
          borderColor: accent.primarySolid,
          alignItems: "center",
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Text style={{ color: accent.primarySolid, ...Type.headline }}>Complete Day</Text>
      </Pressable>
    </View>
  );
}

export default TodayCompleteDayButton;
