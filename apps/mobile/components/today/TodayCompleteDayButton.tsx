import React, { memo } from "react";
import { View } from "react-native";
import { Layout } from "@/constants/layout";
import { SupprButton } from "@/components/ui/SupprButton";
import { dateKeyFromDate } from "@/lib/nutritionJournal";
import { exportDayToHealth, isHealthSyncAvailable } from "@/lib/healthSync";
import { isFeatureEnabled } from "@/lib/analytics";

/**
 * TodayCompleteDayButton — the day's terminal action on the Today scroll.
 *
 * Extracted from `apps/mobile/app/(tabs)/index.tsx` (ENG-1065 / F-158) so the
 * Today screen file moves toward the 400-line target rather than away from it.
 *
 * Button system (2026-06-12, `docs/decisions/2026-06-12-button-system-solid-primary.md`):
 * Complete Day is this card/section's ONE primary action → `SupprButton`
 * `variant="primary"` (solid aubergine fill, white label, pill, no shadow —
 * the solid fill IS the affordance). Supersedes the old aubergine-OUTLINE
 * treatment which read weak/floating on the flat cream ground. Mirror of web
 * `NutritionTracker` Complete Day.
 *
 * F-158 (founder TF57): the button read as "stylistically out of place —
 * floating in dead space" because it was the one scroll-body element that
 * skipped the section grammar — an off-rhythm `marginTop: Spacing.lg` (20)
 * where every sibling section uses `Layout.todaySectionBreak` (32), and no
 * section wrapper. It now sits in a section <View> on the standard 32pt
 * cadence as the final section, so it reads as the day's closing action rather
 * than a stray button. Label + behaviour unchanged.
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

function TodayCompleteDayButtonImpl({
  userId,
  selectedDate,
  onComplete,
}: TodayCompleteDayButtonProps) {
  const tierV1 = isFeatureEnabled("today_tracker_tier_v1");
  return (
    <View style={{ marginTop: tierV1 ? 0 : Layout.todaySectionBreak }}>
      <SupprButton
        variant="primary"
        accessibilityLabel="Complete day"
        label="Complete Day"
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
      />
    </View>
  );
}

export const TodayCompleteDayButton = memo(TodayCompleteDayButtonImpl);

export default TodayCompleteDayButton;
