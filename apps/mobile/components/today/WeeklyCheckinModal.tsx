import React, { memo } from "react";
import { SHEET_RADIUS } from "@/components/ui/SupprCard";
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X, TrendingUp } from "lucide-react-native";
import { withAlpha, FontFamily, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { SupprButton } from "@/components/ui/SupprButton";
import type { WeeklyCheckinContent } from "@/lib/weeklyCheckin";
import { WEEKLY_CHECKIN_BURN_DELTA_LABEL } from "@suppr/shared/onboarding/figmaCopy";

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

function WeeklyCheckinModalImpl({
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
  const accent = useAccent();
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
            borderTopLeftRadius: SHEET_RADIUS,
            borderTopRightRadius: SHEET_RADIUS,
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
              backgroundColor: withAlpha(accent.primary, 0x18),
              alignItems: "center",
              justifyContent: "center",
              marginBottom: Spacing.dense,
            }}
          >
            <TrendingUp size={24} color={accent.primary} strokeWidth={2.25} />
          </View>

          <Text
            accessibilityRole="header"
            style={{
              fontSize: 18,
              fontWeight: "700",
              color: textColor,
              textAlign: "center",
              marginBottom: Spacing.sm,
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
              label="Avg logged daily"
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
            {/*
              P1 (customer-lens 2026-05-11): "TDEE delta" is jargon
              the broader MFP-refugee cohort won't recognise (only
              MacroFactor refugees know "TDEE"). The whyLine above
              already says this in plain English ("Your real burn is
              ±X kcal higher/lower than the formula"), so this row's
              label is the only jargon left. Renamed to
              "Estimated burn change" — same number, accessible
              vocabulary. ENG-1461 (2026-07-07): now the shared
              `WEEKLY_CHECKIN_BURN_DELTA_LABEL` constant so web's
              WeeklyCheckinDialog (which still rendered raw "TDEE delta"
              until this fix) can never drift from this wording again.
            */}
            {content.tdeeDeltaKcal != null ? (
              <Row
                label={WEEKLY_CHECKIN_BURN_DELTA_LABEL}
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
              borderColor: withAlpha(accent.primary, 0x55),
              backgroundColor: withAlpha(accent.primary, 0x10),
              borderRadius: Radius.md,
              paddingVertical: Spacing.md,
              paddingHorizontal: Spacing.md,
              marginBottom: Spacing.lg,
            }}
          >
            <Text
              // headers census 2026-06-10: hand-rolled eyebrow → Type.label.
              style={{ ...Type.label, color: textSecondaryColor, marginBottom: Spacing.sm }}
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
              {/* SLOE Phase 0: the suggested-target hero numeral reads in
                  Newsreader serif (big numerals are a serif moment). Family
                  carries the weight, so the sans `fontWeight: 800` is dropped;
                  the struck-out prior value + `kcal/day` unit stay sans. */}
              <Text
                style={[
                  {
                    fontFamily: FontFamily.serifRegular,
                    fontSize: 22,
                    color: accent.primarySolid,
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
                    marginLeft: Spacing.xs,
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
                ...Type.captionSmall,
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

          {/* Button system (2026-06-12): the modal's main CTA "Accept new
              target" → SOLID-aubergine primary `SupprButton` (white label,
              full-width pill). "Keep current" is the tertiary → GHOST
              `SupprButton` (transparent, plum label, no border). Supersedes
              the old aubergine-OUTLINE primary + neutral-grey-outline
              tertiary. Mirror of web `WeeklyCheckinDialog`. */}
          <SupprButton
            variant="primary"
            label="Accept new target"
            accessibilityLabel="Accept new target"
            onPress={onAccept}
            style={{ width: "100%", marginBottom: Spacing.sm }}
          />

          <SupprButton
            variant="ghost"
            label="Keep current"
            accessibilityLabel="Keep current target"
            onPress={onDismiss}
            style={{ width: "100%" }}
          />
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

export const WeeklyCheckinModal = memo(WeeklyCheckinModalImpl);

export default WeeklyCheckinModal;
