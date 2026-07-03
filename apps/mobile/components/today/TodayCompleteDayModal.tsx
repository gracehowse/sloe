import React, { memo } from "react";
import { SHEET_RADIUS } from "@/components/ui/SupprCard";
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, X } from "lucide-react-native";
import { Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { SupprButton } from "@/components/ui/SupprButton";
import { CompleteDayV3Section } from "@/components/today/CompleteDayV3Section";
import { COMPLETE_DAY_V3_COPY } from "@suppr/shared/completeDayV3";
import { isFeatureEnabled } from "@/lib/analytics";
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
  todayProteinG?: number;
  proteinTargetG?: number;
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
  borderColor: string;
}

function TodayCompleteDayModalImpl({
  visible,
  onClose,
  isToday,
  profileWeightKg,
  todayCalories,
  targetCalories,
  todayProteinG = 0,
  proteinTargetG,
  maintenanceTdeeKcal,
  profileGoal,
  onViewProgress,
  cardColor,
  textColor,
  textSecondaryColor,
  borderColor,
}: TodayCompleteDayModalProps) {
  const accent = useAccent();
  const insets = useSafeAreaInsets();
  const v3 = isFeatureEnabled("eng1247_section_a_v1");
  const dayLabel = new Date().toLocaleDateString(undefined, { weekday: "long" });
  const title = v3 ? COMPLETE_DAY_V3_COPY.title : isToday ? "Day logged!" : "Day complete";
  const prediction =
    profileWeightKg != null && todayCalories > 0
      ? projectWeight({
          currentWeightKg: profileWeightKg,
          todayCalories,
          targetCalories,
          maintenanceTdeeKcal,
          goal: profileGoal,
        })
      : null;

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
            alignItems: v3 ? "stretch" : "center",
          }}
        >
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close" style={{ position: "absolute", top: 16, right: 20 }}>
            <X size={24} color={textSecondaryColor} strokeWidth={2.25} />
          </Pressable>
          <Text
            style={{
              fontSize: v3 ? 20 : 18,
              fontWeight: "700",
              color: textColor,
              marginBottom: 24,
              textAlign: v3 ? "left" : "center",
            }}
          >
            {title}
          </Text>

          {!v3 ? (
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: accent.primary + "18",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 24,
                alignSelf: "center",
              }}
            >
              <Check size={40} color={accent.primary} strokeWidth={1.75} />
            </View>
          ) : null}

          {v3 && prediction && profileWeightKg != null ? (
            <CompleteDayV3Section
              dayLabel={dayLabel}
              eatenKcal={todayCalories}
              targetKcal={targetCalories}
              proteinG={todayProteinG}
              proteinTargetG={proteinTargetG}
              currentWeightKg={profileWeightKg}
              projectedWeightKg={prediction.projectedWeightKg}
              projectionWeeks={prediction.projectionWeeks}
              textColor={textColor}
              textSecondaryColor={textSecondaryColor}
              borderColor={borderColor}
              cardColor={cardColor}
            />
          ) : null}

          {!v3 && profileWeightKg != null && todayCalories > 0 && prediction ? (
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
                <Text style={{ color: accent.primarySolid }}>{prediction.projectedWeightKg} kg</Text>
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
                  ? "Based on today\u2019s logged calories repeated daily (7,700 kcal \u2248 1 kg). An estimate, not a promise."
                  : "Based on this day\u2019s logged calories repeated daily (7,700 kcal \u2248 1 kg). An estimate, not a promise."}
              </Text>
            </>
          ) : null}

          {!v3 && (profileWeightKg == null || todayCalories <= 0) ? (
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
          ) : null}

          {v3 && (profileWeightKg == null || todayCalories <= 0) ? (
            <Text style={{ ...Type.body, color: textSecondaryColor, marginBottom: Spacing.lg }}>
              Great work logging today! Set your weight in your profile to see weight projections here.
            </Text>
          ) : null}

          <SupprButton
            variant="primary"
            label="View my progress"
            accessibilityLabel="View my progress"
            onPress={onViewProgress}
            style={{ width: "100%", marginTop: Spacing.lg }}
          />
        </View>
      </View>
    </Modal>
  );
}

export const TodayCompleteDayModal = memo(TodayCompleteDayModalImpl);

export default TodayCompleteDayModal;
