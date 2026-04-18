import React from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Accent, Radius, Spacing } from "@/constants/theme";
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
  profileGoal: string | null;
  onViewProgress: () => void;
  cardColor: string;
  textColor: string;
  textSecondaryColor: string;
  textTertiaryColor: string;
}

export function TodayCompleteDayModal({
  visible,
  onClose,
  isToday,
  profileWeightKg,
  todayCalories,
  targetCalories,
  profileGoal,
  onViewProgress,
  cardColor,
  textColor,
  textSecondaryColor,
  textTertiaryColor,
}: TodayCompleteDayModalProps) {
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
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingTop: Spacing.xl,
            paddingBottom: insets.bottom + Spacing.xl,
            paddingHorizontal: Spacing.xl,
            alignItems: "center",
          }}
        >
          <Pressable onPress={onClose} style={{ position: "absolute", top: 16, left: 20 }}>
            <Ionicons name="close" size={24} color={textTertiaryColor} />
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: "700", color: textColor, marginBottom: 24 }}>
            {isToday ? "Day logged!" : "Day complete"}
          </Text>

          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: Accent.primary + "18",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 24,
            }}
          >
            <Ionicons name="checkmark" size={40} color={Accent.primary} />
          </View>

          {profileWeightKg != null && todayCalories > 0 ? (() => {
            const prediction = projectWeight({
              currentWeightKg: profileWeightKg,
              todayCalories,
              targetCalories,
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
                  <Text style={{ color: Accent.primary }}>{prediction.projectedWeightKg} kg</Text>
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
                  {isToday
                    ? "Based on today\u2019s logged calories repeated daily (7,700 kcal \u2248 1 kg). Your Journey page uses your 7-day average, so the number there may differ."
                    : "Based on this day\u2019s logged calories repeated daily (7,700 kcal \u2248 1 kg). Your Journey page uses your 7-day average, so the number there may differ."}
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

          <Pressable
            onPress={onViewProgress}
            style={{
              width: "100%",
              paddingVertical: 16,
              borderRadius: Radius.md,
              backgroundColor: Accent.primary,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>View my progress</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default TodayCompleteDayModal;
