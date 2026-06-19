import React, { memo } from "react";
import { SHEET_RADIUS } from "@/components/ui/SupprCard";
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { X } from "lucide-react-native";
import { Spacing } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { SupprButton } from "@/components/ui/SupprButton";
import { projectWeight } from "@/lib/weightProjection";

/**
 * TodayCompleteDayModal — "Day logged!" confirmation sheet with the
 * weight-projection line.
 *
 * Extracted from `apps/mobile/app/(tabs)/index.tsx` (audit H3,
 * 2026-04-18).
 */
export interface TodayCompleteDayModalProps {
  visible: boolean;
  onClose: () => void;
  isToday: boolean;
  profileWeightKg: number | null;
  todayCalories: number;
  targetCalories: number;
  /**
   * Effective maintenance TDEE (adaptive when confidence is medium/high,
   * else static Mifflin). Optional for backwards compatibility, but callers
   * should always supply it — without it the projection falls back to a
   * crude target-based heuristic that mis-classifies real deficits as gains
   * when actual burn is high. See TestFlight `ALkK-XrcMz_V-D6NrjuVYbo`.
   */
  maintenanceTdeeKcal?: number | null;
  profileGoal: string | null;
  onViewProgress: () => void;
  cardColor: string;
  textColor: string;
  textSecondaryColor: string;
  textTertiaryColor: string;
}

function TodayCompleteDayModalImpl({
  visible,
  onClose,
  isToday,
  profileWeightKg,
  todayCalories,
  targetCalories,
  maintenanceTdeeKcal,
  profileGoal,
  onViewProgress,
  cardColor,
  textColor,
  textSecondaryColor,
  textTertiaryColor,
}: TodayCompleteDayModalProps) {
  const accent = useAccent();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)" }}
          onPress={onClose}
        />
        <View
          style={{
            backgroundColor: cardColor,
            borderTopLeftRadius: SHEET_RADIUS,
            borderTopRightRadius: SHEET_RADIUS,
            paddingTop: Spacing.xl,
            paddingBottom: insets.bottom + Spacing.xl,
            paddingHorizontal: Spacing.xl,
            alignItems: "center",
          }}
        >
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close" style={{ position: "absolute", top: 16, right: 20 }}>
            <X size={24} color={textSecondaryColor} strokeWidth={2.25} />
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: "700", color: textColor, marginBottom: 24 }}>
            {isToday ? "Day logged!" : "Day complete"}
          </Text>

          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: accent.primary + "18",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 24,
            }}
          >
            <Ionicons name="checkmark" size={40} color={accent.primary} />
          </View>

          {profileWeightKg != null && todayCalories > 0 ? (() => {
            const prediction = projectWeight({
              currentWeightKg: profileWeightKg,
              todayCalories,
              targetCalories,
              maintenanceTdeeKcal,
              goal: profileGoal,
            });
            return (
              <>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "700",
                    color: textColor,
                    textAlign: "center",
                    lineHeight: 26,
                    marginBottom: 8,
                  }}
                >
                  {isToday ? "Today\u2019s trajectory" : "This day\u2019s trajectory"}:{" "}
                  <Text style={{ color: accent.primary }}>{prediction.projectedWeightKg} kg</Text>
                  {" "}in ~{prediction.projectionWeeks} weeks
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: textSecondaryColor,
                    textAlign: "center",
                    marginBottom: 24,
                    paddingHorizontal: 20,
                  }}
                >
                  {/* ENG-741 \u2014 dropped the "Your Journey page uses your
                      7-day average\u2026" sentence. The Progress trajectory /
                      Journey projection is gated to \u22655 logged days, so a
                      user seeing this modal on day 1-4 was pointed at a
                      projection that isn't on Progress yet. The remaining
                      copy is truthful about THIS modal's single-day basis
                      without promising a Progress projection. */}
                  {isToday
                    ? "Based on today\u2019s logged calories repeated daily (7,700 kcal \u2248 1 kg). An estimate, not a promise."
                    : "Based on this day\u2019s logged calories repeated daily (7,700 kcal \u2248 1 kg). An estimate, not a promise."}
                </Text>
              </>
            );
          })() : (
            <Text
              style={{
                fontSize: 14,
                color: textSecondaryColor,
                textAlign: "center",
                marginBottom: 24,
              }}
            >
              Great work logging today! Set your weight in your profile to see weight projections here.
            </Text>
          )}

          {/* Button system (2026-06-12): this confirmation sheet's sole CTA →
              SOLID-aubergine primary `SupprButton` (white label, full-width
              pill). It's the one/only action on the modal, so it earns the
              primary treatment. Supersedes the old aubergine-OUTLINE.
              Mirror of web `TodayCompleteDayDialog`. */}
          <SupprButton
            variant="primary"
            label="View my progress"
            accessibilityLabel="View my progress"
            onPress={onViewProgress}
            style={{ width: "100%" }}
          />
        </View>
      </View>
    </Modal>
  );
}

export const TodayCompleteDayModal = memo(TodayCompleteDayModalImpl);

export default TodayCompleteDayModal;
