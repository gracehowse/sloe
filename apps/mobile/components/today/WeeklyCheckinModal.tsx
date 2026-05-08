import React from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X, TrendingUp } from "lucide-react-native";
import { Accent, Radius, Spacing } from "@/constants/theme";
import type { WeeklyCheckinContent } from "@/lib/weeklyCheckin";

/**
 * WeeklyCheckinModal — the MacroFactor-style weekly TDEE check-in
 * ritual. Surfaces the adaptive-vs-formula delta + the suggested new
 * daily target, and asks the user to accept or keep current.
 *
 * Pure presentation — gating + content build live in
 * `src/lib/nutrition/weeklyCheckin.ts`. The host (`Today`) is
 * responsible for:
 *   - calling `shouldShowWeeklyCheckin` on Today first-load,
 *   - building content via `buildWeeklyCheckinContent`,
 *   - persisting `last_weekly_checkin_shown_at` + decision when the
 *     user closes the modal.
 *
 * The modal NEVER blocks — every dismiss path (close X, Keep current,
 * backdrop) routes through `onDismiss` so the host can persist the
 * "kept current" state and move on.
 */
export interface WeeklyCheckinModalProps {
  visible: boolean;
  /** Display content. `null` is a programming error — only mount the
   *  modal when content is built. */
  content: WeeklyCheckinContent | null;
  /** Current daily calorie target (used for the "from" side of the
   *  suggestion). Always render — tabular-nums on numbers. */
  currentTargetKcal: number;
  /** "Accept new target" — host updates `target_calories` to
   *  `content.suggestedTargetKcal` and persists the decision. */
  onAccept: () => void;
  /** "Keep current" — host persists the decision but leaves target
   *  alone. Also fired from the close X and backdrop tap. */
  onDismiss: () => void;
  cardColor: string;
  textColor: string;
  textSecondaryColor: string;
  borderColor: string;
}

export function WeeklyCheckinModal({
  visible,
  content,
  currentTargetKcal,
  onAccept,
  onDismiss,
  cardColor,
  textColor,
  textSecondaryColor,
  borderColor,
}: WeeklyCheckinModalProps) {
  const insets = useSafeAreaInsets();
  if (!content) return null;

  const tabularStyle = { fontVariant: ["tabular-nums"] as ("tabular-nums")[] };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
          }}
          onPress={onDismiss}
        />
        <View
          style={{
            backgroundColor: cardColor,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingTop: Spacing.xl,
            paddingBottom: insets.bottom + Spacing.xl,
            paddingHorizontal: Spacing.xl,
          }}
        >
          <Pressable
            onPress={onDismiss}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={{ position: "absolute", top: 16, right: 20 }}
          >
            <X size={24} color={textSecondaryColor} strokeWidth={2.25} />
          </Pressable>

          <View
            style={{
              alignSelf: "center",
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: Accent.primary + "18",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 12,
            }}
          >
            <TrendingUp size={24} color={Accent.primary} strokeWidth={2.25} />
          </View>

          <Text
            accessibilityRole="header"
            style={{
              fontSize: 18,
              fontWeight: "700",
              color: textColor,
              textAlign: "center",
              marginBottom: 6,
            }}
          >
            {content.headline}
          </Text>

          <Text
            style={{
              fontSize: 14,
              color: textSecondaryColor,
              textAlign: "center",
              marginBottom: 20,
              paddingHorizontal: 8,
            }}
          >
            {content.whyLine}
          </Text>

          {/* Stats card — avg this week, weight delta (when present),
              TDEE delta (when computable). */}
          <View
            style={{
              borderWidth: 1,
              borderColor,
              borderRadius: Radius.md,
              paddingVertical: Spacing.md,
              paddingHorizontal: Spacing.md,
              marginBottom: Spacing.md,
            }}
          >
            <Row
              label="Avg this week"
              value={content.avgThisWeekLabel}
              textColor={textColor}
              textSecondaryColor={textSecondaryColor}
              tabularStyle={tabularStyle}
            />
            {content.weightDeltaLabel ? (
              <Row
                label="Weight delta"
                value={content.weightDeltaLabel}
                textColor={textColor}
                textSecondaryColor={textSecondaryColor}
                tabularStyle={tabularStyle}
                topMargin
              />
            ) : null}
            {content.tdeeDeltaKcal != null ? (
              <Row
                label="TDEE delta"
                value={
                  content.tdeeDeltaKcal === 0
                    ? "0 kcal"
                    : `${content.tdeeDeltaKcal > 0 ? "+" : "−"}${Math.abs(content.tdeeDeltaKcal)} kcal`
                }
                textColor={textColor}
                textSecondaryColor={textSecondaryColor}
                tabularStyle={tabularStyle}
                topMargin
              />
            ) : null}
          </View>

          {/* Suggested target row */}
          <View
            style={{
              borderWidth: 1,
              borderColor: Accent.primary + "55",
              backgroundColor: Accent.primary + "10",
              borderRadius: Radius.md,
              paddingVertical: Spacing.md,
              paddingHorizontal: Spacing.md,
              marginBottom: Spacing.lg,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: textSecondaryColor,
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Suggested daily target
            </Text>
            <View style={{ flexDirection: "row", alignItems: "baseline" }}>
              <Text
                style={[
                  {
                    fontSize: 14,
                    color: textSecondaryColor,
                    textDecorationLine: "line-through",
                    marginRight: 8,
                  },
                  tabularStyle,
                ]}
              >
                {Math.round(currentTargetKcal).toLocaleString("en-GB")}
              </Text>
              <Text
                style={[
                  {
                    fontSize: 22,
                    fontWeight: "800",
                    color: Accent.primary,
                  },
                  tabularStyle,
                ]}
                accessibilityLabel={`Suggested ${content.suggestedTargetKcal} kilocalories per day`}
              >
                {content.suggestedTargetKcal.toLocaleString("en-GB")}
              </Text>
              <Text
                style={[
                  {
                    fontSize: 14,
                    color: textSecondaryColor,
                    marginLeft: 6,
                  },
                  tabularStyle,
                ]}
              >
                kcal/day
              </Text>
            </View>
          </View>

          {/* 2026-05-08 build-47 follow-up — Grace `APPzhqLXgb64_9reZ44rGk4`:
              "If my tdee is lower why is my target higher?" — when the
              math says the target should drop below the 1,200 kcal safety
              floor, we clamp up. Without this explainer the suggestion
              looked contradictory. */}
          {content.floorAppliedKcal != null ? (
            <Text
              accessibilityLiveRegion="polite"
              style={{
                fontSize: 12,
                lineHeight: 17,
                color: textSecondaryColor,
                textAlign: "center",
                marginBottom: 16,
                paddingHorizontal: 8,
              }}
            >
              The math would land at{" "}
              <Text style={{ fontWeight: "600" }}>
                {content.floorAppliedKcal.toLocaleString("en-GB")} kcal/day
              </Text>
              , but eating that little long-term isn&apos;t safe. We&apos;ve capped
              the suggestion at the{" "}
              <Text style={{ fontWeight: "600" }}>1,200 kcal/day</Text>{" "}
              minimum.
            </Text>
          ) : null}

          <Pressable
            onPress={onAccept}
            accessibilityRole="button"
            accessibilityLabel="Accept new target"
            style={{
              width: "100%",
              paddingVertical: 16,
              borderRadius: Radius.md,
              backgroundColor: Accent.primary,
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
              Accept new target
            </Text>
          </Pressable>

          <Pressable
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Keep current target"
            style={{
              width: "100%",
              paddingVertical: 16,
              borderRadius: Radius.md,
              backgroundColor: "transparent",
              alignItems: "center",
              borderWidth: 1,
              borderColor,
            }}
          >
            <Text style={{ color: textColor, fontWeight: "600", fontSize: 16 }}>
              Keep current
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function Row({
  label,
  value,
  textColor,
  textSecondaryColor,
  tabularStyle,
  topMargin,
}: {
  label: string;
  value: string;
  textColor: string;
  textSecondaryColor: string;
  tabularStyle: { fontVariant: ("tabular-nums")[] };
  topMargin?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: topMargin ? 8 : 0,
      }}
    >
      <Text style={{ fontSize: 14, color: textSecondaryColor }}>{label}</Text>
      <Text
        style={[
          { fontSize: 14, fontWeight: "600", color: textColor },
          tabularStyle,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

export default WeeklyCheckinModal;
