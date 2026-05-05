import React from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X, Sparkles, Flame, Utensils, Scale } from "lucide-react-native";
import { Accent, Radius, Spacing } from "@/constants/theme";
import {
  MILESTONE_30_DAY_THRESHOLD,
  type Milestone30DayContent,
} from "@/lib/milestone30Day";

/**
 * Milestone30DayModal — the "30 days of logging" trust moment.
 *
 * Pure presentation; gating + content build live in
 * `src/lib/nutrition/milestone30Day.ts`. The host (`Today`) is
 * responsible for:
 *   - calling `shouldShowMilestone30Day` on Today first-load,
 *   - building content via `buildMilestone30DayContent`,
 *   - persisting `milestone_30_shown_at` once when the user closes.
 *
 * Single CTA: "Keep going" — pure trust moment, no paywall, no
 * upsell. The close X has the same effect; both route through
 * `onDismiss`.
 */
export interface Milestone30DayModalProps {
  visible: boolean;
  /** `null` is a programming error — only mount the modal when
   *  content is built. */
  content: Milestone30DayContent | null;
  onDismiss: () => void;
  cardColor: string;
  textColor: string;
  textSecondaryColor: string;
  borderColor: string;
}

export function Milestone30DayModal({
  visible,
  content,
  onDismiss,
  cardColor,
  textColor,
  textSecondaryColor,
  borderColor,
}: Milestone30DayModalProps) {
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
            paddingHorizontal: Spacing.xl,
            paddingBottom: Spacing.md,
            maxHeight: "85%",
            // Audit 2026-05-04 #33: soft shadow gives the sheet a
            // raised feel against the dimmed backdrop instead of
            // looking pasted on.
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -8 },
            shadowOpacity: 0.18,
            shadowRadius: 24,
            elevation: 16,
          }}
        >
          <Pressable
            onPress={onDismiss}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={{ position: "absolute", top: 16, right: 20, zIndex: 2 }}
          >
            <X size={24} color={textSecondaryColor} strokeWidth={2.25} />
          </Pressable>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ paddingTop: Spacing.sm, paddingBottom: Spacing.sm }}
          >
            <View
              style={{
                alignSelf: "center",
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: Accent.primary + "18",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 14,
              }}
            >
              <Sparkles size={30} color={Accent.primary} strokeWidth={2.25} />
            </View>

            <Text
              accessibilityRole="header"
              style={[
                {
                  fontSize: 22,
                  fontWeight: "800",
                  color: textColor,
                  textAlign: "center",
                  marginBottom: 4,
                },
                tabularStyle,
              ]}
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
              You crossed {MILESTONE_30_DAY_THRESHOLD}+ distinct days with meals
              logged — here&apos;s a snapshot (averages, favourites, and your best
              consecutive run).
            </Text>

            {/* Stats card 1: avg kcal + longest streak */}
            <View
              style={{
                flexDirection: "row",
                gap: Spacing.sm,
                marginBottom: Spacing.md,
              }}
            >
              <StatTile
                icon={<Flame size={18} color={Accent.primary} strokeWidth={2.25} />}
                label="Avg daily kcal"
                value={`${content.avgDailyKcal.toLocaleString("en-GB")}`}
                textColor={textColor}
                textSecondaryColor={textSecondaryColor}
                borderColor={borderColor}
                tabularStyle={tabularStyle}
              />
              <StatTile
                icon={<Sparkles size={18} color={Accent.primary} strokeWidth={2.25} />}
                // Audit 2026-05-04 #26: "Best consecutive run" upper-cased
                // to "BEST CONSECUTIVE R…" with a trailing ellipsis at
                // the available column width on iPhone 16 Pro. Shorter
                // label fits cleanly without changing meaning.
                label="Best run"
                value={`${content.longestStreak} day${content.longestStreak === 1 ? "" : "s"}`}
                textColor={textColor}
                textSecondaryColor={textSecondaryColor}
                borderColor={borderColor}
                tabularStyle={tabularStyle}
              />
            </View>

            {/* Top foods */}
            {content.topFoods.length > 0 ? (
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
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 10,
                  }}
                >
                  <Utensils size={16} color={Accent.primary} strokeWidth={2.25} />
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: textSecondaryColor,
                      marginLeft: 6,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    Most-logged foods
                  </Text>
                </View>
                {content.topFoods.map((food, idx) => (
                  <View
                    key={`${food.name}-${idx}`}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: idx === 0 ? 0 : 6,
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      style={{
                        flex: 1,
                        fontSize: 14,
                        color: textColor,
                        marginRight: 8,
                      }}
                    >
                      {idx + 1}. {food.name}
                    </Text>
                    <Text
                      style={[
                        {
                          fontSize: 13,
                          color: textSecondaryColor,
                          fontWeight: "600",
                        },
                        tabularStyle,
                      ]}
                    >
                      {food.count}×
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Weight delta — suppressed when null (no fabricated zero) */}
            {content.totalWeightDeltaKg != null ? (
              <View
                style={{
                  borderWidth: 1,
                  borderColor,
                  borderRadius: Radius.md,
                  paddingVertical: Spacing.md,
                  paddingHorizontal: Spacing.md,
                  marginBottom: Spacing.md,
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <Scale size={18} color={Accent.primary} strokeWidth={2.25} />
                <Text
                  style={{
                    fontSize: 14,
                    color: textSecondaryColor,
                    marginLeft: 8,
                    flex: 1,
                  }}
                >
                  Weight (first→last log day)
                </Text>
                <Text
                  style={[
                    { fontSize: 14, fontWeight: "700", color: textColor },
                    tabularStyle,
                  ]}
                >
                  {formatSignedKg(content.totalWeightDeltaKg)}
                </Text>
              </View>
            ) : null}
          </ScrollView>

          {/* Outside ScrollView so the CTA always receives taps (Fabric modal + long scroll). */}
          <Pressable
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Keep going"
            style={{
              width: "100%",
              paddingVertical: 16,
              borderRadius: Radius.md,
              backgroundColor: Accent.primary,
              alignItems: "center",
              marginTop: Spacing.sm,
              marginBottom: insets.bottom > 0 ? insets.bottom : Spacing.md,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
              Keep going
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function StatTile({
  icon,
  label,
  value,
  textColor,
  textSecondaryColor,
  borderColor,
  tabularStyle,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  textColor: string;
  textSecondaryColor: string;
  borderColor: string;
  tabularStyle: { fontVariant: ("tabular-nums")[] };
}) {
  return (
    <View
      style={{
        flex: 1,
        borderWidth: 1,
        borderColor,
        borderRadius: Radius.md,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.md,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
        {icon}
        <Text
          style={{
            fontSize: 11,
            fontWeight: "700",
            color: textSecondaryColor,
            marginLeft: 6,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
      <Text
        style={[
          { fontSize: 18, fontWeight: "800", color: textColor },
          tabularStyle,
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function formatSignedKg(n: number): string {
  if (n === 0) return "0.0 kg";
  const sign = n > 0 ? "+" : "−";
  return `${sign}${Math.abs(n).toFixed(1)} kg`;
}

export default Milestone30DayModal;
