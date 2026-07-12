/**
 * Goal-pace re-tune sheet — MacroFactor parity.
 *
 * Spec: extended-competitor-audit task (2026-04-30, Step 2).
 *
 * The user opens this from the Weekly Check-in section on
 * `/weekly-recap`. They pick a new pace (kg/week), see a live preview
 * of the new daily target, and confirm. On confirm we:
 *   1. Re-run `computeRetunedTargets` against the user's effective
 *      TDEE + body stats.
 *   2. Write the new (target_calories, target_protein, target_carbs,
 *      target_fat, target_fiber_g, plan_pace) values to `profiles`.
 *   3. Fire `goal_pace_adjusted` analytics with the before/after.
 *
 * Posture rules:
 *   - Soft-warn when the new target dips below the safety floor — the
 *     user is informed but the Confirm button stays enabled. Mirrors
 *     the onboarding Pace step (decision doc 2026-04-19).
 *   - No emoji, no "amazing", no streak-anxiety copy.
 *
 * Mobile-only — web has Settings → Targets which already covers the
 * same write surface; we don't introduce a parallel modal there.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { SHEET_RADIUS } from "@/components/ui/SupprCard";
import { SupprButton } from "@/components/ui/SupprButton";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Check, X } from "lucide-react-native";

import { Accent, FontFamily, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { supabase } from "@/lib/supabase";
import { isFeatureEnabled, track } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import {
  computeRetunedTargets,
  dbGoalForOnboardingGoal,
  inferCurrentPace,
  paceLabel,
  RETUNE_PACE_PRESETS_KG_PER_WEEK,
  type RetunePace,
} from "@/lib/goalPaceRetune";
import {
  onboardingGoalForDbGoal,
} from "@suppr/nutrition-core/goalPaceRetune";
import { formatKcal } from "@/lib/weeklyCheckin";
import { backfillDailyTargetsFromProfile } from "@suppr/nutrition-core/dailyTargetSnapshot";
import { recordGoalHistory } from "@suppr/nutrition-core/goalHistory";
import type { Goal } from "@suppr/shared/onboarding/state";
import type { NutritionStrategy, Sex } from "@suppr/nutrition-core/tdee";

export interface GoalPaceRetuneSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Effective TDEE — caller passes the adaptive value when present,
   *  otherwise the formula fallback. Required + > 0. */
  tdeeKcal: number;
  /** User's current goal in DB form ("cut" | "maintain" | "bulk"). */
  dbGoal: "cut" | "maintain" | "bulk";
  /** User's nutrition strategy (drives macro split). */
  strategy: NutritionStrategy | null;
  /** Body stats. */
  weightKg: number;
  sex: Sex;
  /** Current calorie target — used to infer the slider's starting
   *  position and surfaced in the "was X kcal" line. */
  currentTargetKcal: number;
  /** User ID for the profile write. */
  userId: string;
  /** Called after a successful write so the parent can refetch. */
  onSaved?: () => void;
}

const PACE_OPTIONS: readonly RetunePace[] = [
  0,
  ...RETUNE_PACE_PRESETS_KG_PER_WEEK,
];

/** Map onboarding `Goal` back to the DB `plan_pace` string the
 *  profile column accepts. The four canonical values exposed by the
 *  preset list map 1:1 to the four named paces in `tdee.ts`. */
function planPaceForKgPerWeek(paceKgPerWeek: RetunePace): string | null {
  switch (paceKgPerWeek) {
    case 0:
      return null; // maintain — clear plan_pace
    case 0.25:
      return "relaxed";
    case 0.5:
      return "steady";
    case 0.75:
      return "accelerated";
    case 1.0:
      return "vigorous";
    default:
      return null;
  }
}

export function GoalPaceRetuneSheet(props: GoalPaceRetuneSheetProps) {
  const accent = useAccent();
  const colors = useThemeColors();
  // Selected pace option (edge/tint/check) + the Confirm CTA use the aubergine
  // `accent.primarySolid` / `accent.primarySoft` treatment (Sloe, 2026-06-08).
  // Pace cautions keep `Accent.warning`.
  const {
    visible,
    onClose,
    tdeeKcal,
    dbGoal,
    strategy,
    weightKg,
    sex,
    currentTargetKcal,
    userId,
    onSaved,
  } = props;

  const goal: Goal = useMemo(
    () => onboardingGoalForDbGoal(dbGoal, strategy),
    [dbGoal, strategy],
  );

  const inferredPace = useMemo(
    () =>
      inferCurrentPace({
        tdeeKcal,
        targetCalories: currentTargetKcal,
        goal,
      }) ?? 0.5,
    [tdeeKcal, currentTargetKcal, goal],
  );

  const [selectedPace, setSelectedPace] = useState<RetunePace>(inferredPace);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setSelectedPace(inferredPace);
      setError(null);
      setSaving(false);
    }
  }, [visible, inferredPace]);

  const preview = useMemo(
    () =>
      computeRetunedTargets({
        tdeeKcal,
        goal,
        strategy,
        weightKg,
        sex,
        paceKgPerWeek: selectedPace,
      }),
    [tdeeKcal, goal, strategy, weightKg, sex, selectedPace],
  );

  const handleConfirm = useCallback(async () => {
    if (!preview || !userId) {
      onClose();
      return;
    }
    setSaving(true);
    setError(null);

    try {
      const planPace = planPaceForKgPerWeek(selectedPace);
      const updates: Record<string, unknown> = {
        target_calories: preview.targetCalories,
        target_protein: preview.proteinG,
        target_carbs: preview.carbsG,
        target_fat: preview.fatG,
        target_fiber_g: preview.fiberG,
      };
      // Only update plan_pace when the user picked a non-maintain pace.
      // Maintain leaves plan_pace alone (it doesn't apply).
      if (planPace) updates.plan_pace = planPace;
      // When the user selects "Maintain" (0 kg/week) on a cut/bulk goal,
      // we also flip the goal to maintain so the chosen pace makes sense.
      // Without this, the cut deficit would silently re-apply on the
      // next refresh. Mirrors onboarding's behaviour.
      if (selectedPace === 0 && dbGoal !== "maintain") {
        updates.goal = "maintain";
      }
      // When the user picks a non-zero pace from a maintain goal, we
      // need to set the goal back to a directional one. We default to
      // "cut" — the most common case — so the deficit applies.
      if (selectedPace !== 0 && dbGoal === "maintain") {
        updates.goal = dbGoalForOnboardingGoal(goal === "maintain" ? "lose" : goal);
      }

      // F-149 (2026-05-10): backfill past-day snapshots BEFORE writing
      // the new targets, so historical days that lack a daily_targets
      // row don't silently flip to the new target on read. Read the
      // current profile (about to become the OLD profile), backfill
      // synthetic snapshots for the past 30 days using its values, then
      // write the new ones. `upsert(..., { ignoreDuplicates: true })`
      // protects existing snapshots — only gaps get filled. Best-effort:
      // if the backfill fails, still proceed with the profile update.
      try {
        const { data: oldProfile } = await supabase
          .from("profiles")
          .select(
            "target_calories, target_protein, target_carbs, target_fat, target_fiber_g, activity_level, plan_pace, goal, adaptive_tdee, adaptive_tdee_confidence, adaptive_tdee_updated_at, sex, weight_kg, height_cm, age",
          )
          .eq("id", userId)
          .maybeSingle();
        if (oldProfile) {
          await backfillDailyTargetsFromProfile(supabase as any, userId, oldProfile, { canonicalEnergyInputs: isFeatureEnabled("energy_numbers_v1") }); // ENG-1506 — OFF keeps the exact legacy input assembly
        }
      } catch {
        // Backfill never blocks the user's retune.
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", userId);

      if (updateError) {
        setError("Couldn't save your new target. Please try again.");
        setSaving(false);
        return;
      }

      // F-149 (2026-05-11): seal today-and-forward by recording the new
      // goal-shape into goal_history. The backfill above protects past
      // days; this call ensures the next time a past-day read needs to
      // resolve "what was the goal on date >= today?", goal_history
      // returns the values we just wrote. Fire-and-forget.
      void recordGoalHistory(
        supabase as any,
        userId,
        {
          activity_level: typeof updates.activity_level === "string" ? updates.activity_level : null,
          goal: typeof updates.goal === "string" ? updates.goal : null,
          plan_pace: typeof updates.plan_pace === "string" ? updates.plan_pace : null,
          target_calories: preview.targetCalories,
          target_protein_g: preview.proteinG,
          target_carbs_g: preview.carbsG,
          target_fat_g: preview.fatG,
          target_fiber_g: preview.fiberG,
        },
        "goal_retune",
      );

      try {
        track(AnalyticsEvents.goal_pace_adjusted, {
          previousPaceKgPerWeek: inferredPace,
          newPaceKgPerWeek: selectedPace,
          previousTargetKcal: currentTargetKcal,
          newTargetKcal: preview.targetCalories,
          belowSafetyFloor: preview.belowSafetyFloor,
          surface: "weekly_checkin_sheet",
        });
      } catch {
        /* fire-and-forget */
      }

      setSaving(false);
      onSaved?.();
      onClose();
    } catch {
      setError("Couldn't save your new target. Please try again.");
      setSaving(false);
    }
  }, [
    preview,
    userId,
    selectedPace,
    inferredPace,
    currentTargetKcal,
    onSaved,
    onClose,
    dbGoal,
    goal,
  ]);

  const sectionLabel = (txt: string) => (
    <Text
      style={{
        fontSize: 11,
        fontWeight: "700",
        color: colors.textTertiary,
        letterSpacing: 0.88,
        textTransform: "uppercase",
        marginBottom: Spacing.sm,
      }}
    >
      {txt}
    </Text>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      testID="goal-pace-retune-sheet"
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.4)",
          justifyContent: "flex-end",
        }}
      >
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: SHEET_RADIUS,
            borderTopRightRadius: SHEET_RADIUS,
            paddingTop: Spacing.lg,
            paddingHorizontal: Spacing.xl,
            paddingBottom: Spacing.xxxl,
            maxHeight: "85%",
          }}
        >
          {/* Drag handle */}
          <View
            style={{
              alignSelf: "center",
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.cardBorder,
              marginBottom: Spacing.md,
            }}
          />

          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: Spacing.lg,
            }}
          >
            <Text
              style={{
                fontSize: 20,
                fontWeight: "700",
                color: colors.text,
                letterSpacing: -0.3,
              }}
            >
              Adjust goal pace
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              hitSlop={10}
              testID="goal-pace-retune-close"
            >
              <X size={24} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: Spacing.lg }}
          >
            {/* Current */}
            {sectionLabel("Current")}
            <Text
              style={{
                fontSize: 14,
                color: colors.textSecondary,
                marginBottom: Spacing.lg,
                lineHeight: 20,
              }}
            >
              {formatKcal(currentTargetKcal)} kcal/day · {paceLabel(inferredPace, goal)}
            </Text>

            {/* Pace picker */}
            {sectionLabel("New pace")}
            <View
              style={{
                flexDirection: "column",
                gap: Spacing.sm,
                marginBottom: Spacing.lg,
              }}
              testID="goal-pace-retune-options"
            >
              {PACE_OPTIONS.map((pace) => {
                const selected = pace === selectedPace;
                const label =
                  pace === 0 ? "Maintain" : `${pace.toFixed(2).replace(/\.?0+$/, "")} kg/week`;
                return (
                  <Pressable
                    key={pace}
                    accessibilityRole="button"
                    accessibilityLabel={`${label} — ${selected ? "selected" : "tap to select"}`}
                    onPress={() => setSelectedPace(pace)}
                    testID={`goal-pace-option-${pace}`}
                    style={{
                      paddingVertical: Spacing.md,
                      paddingHorizontal: Spacing.md,
                      borderRadius: Radius.md,
                      borderWidth: 1.5,
                      // Selected pace — aubergine edge + soft tint + aubergine
                      // check (Sloe treatment #7/#8, 2026-06-08).
                      borderColor: selected ? accent.primarySolid : colors.cardBorder,
                      backgroundColor: selected ? accent.primarySoft : colors.card,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: Type.bodyLarge.fontFamily,
                        fontSize: Type.bodyLarge.fontSize,
                        lineHeight: Type.bodyLarge.lineHeight,
                        fontWeight: selected ? "700" : "500",
                        color: selected ? colors.text : colors.textSecondary,
                      }}
                    >
                      {label}
                    </Text>
                    {selected ? (
                      <Check size={18} color={accent.primarySolid} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>

            {/* Live preview */}
            {sectionLabel("New target")}
            {preview ? (
              <View
                testID="goal-pace-retune-preview"
                style={{
                  backgroundColor: colors.card,
                  borderRadius: Radius.lg,
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                  padding: Spacing.lg,
                  marginBottom: Spacing.md,
                }}
              >
                {/* SLOE Phase 0: the new-target hero kcal reads in Newsreader
                    serif (big numerals are a serif moment); the `kcal` unit
                    stays sans. Family carries the weight. */}
                <Text
                  style={{
                    fontFamily: FontFamily.serifRegular,
                    fontSize: 22,
                    color: colors.text,
                    fontVariant: ["tabular-nums"],
                    marginBottom: 4,
                  }}
                >
                  {formatKcal(preview.targetCalories)}
                  <Text style={{ fontFamily: FontFamily.sansMedium, fontSize: 13, fontWeight: "500", color: colors.textSecondary }}>
                    {" "}kcal
                  </Text>
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: colors.textSecondary,
                    lineHeight: 18,
                    marginBottom: Spacing.sm,
                  }}
                >
                  was {formatKcal(currentTargetKcal)} kcal/day
                </Text>
                <Text
                  style={{
                    ...Type.captionSmall,
                    color: colors.textTertiary,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  Protein {preview.proteinG}g · Carbs {preview.carbsG}g · Fat{" "}
                  {preview.fatG}g · Fibre {preview.fiberG}g
                </Text>
              </View>
            ) : null}

            {/* Soft-warn when below safety floor */}
            {preview?.belowSafetyFloor ? (
              <View
                testID="goal-pace-retune-safety-warn"
                style={{
                  backgroundColor: `${Accent.warning}14`,
                  borderRadius: Radius.md,
                  borderWidth: 1,
                  borderColor: `${Accent.warning}40`,
                  padding: Spacing.md,
                  marginBottom: Spacing.md,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    color: colors.text,
                    lineHeight: 19,
                  }}
                >
                  This pace lands below the general safety floor for
                  unsupervised dieting. Consider a gentler pace, or check in
                  with a clinician.
                </Text>
              </View>
            ) : null}

            {/* Error state */}
            {error ? (
              <View
                style={{
                  marginBottom: Spacing.md,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    color: colors.text,
                    lineHeight: 19,
                  }}
                >
                  {error}
                </Text>
              </View>
            ) : null}

            {/* CTAs */}
            <View
              style={{
                flexDirection: "row",
                gap: Spacing.sm,
                marginTop: Spacing.sm,
              }}
            >
              {/* Sloe button-system canon (2026-06-12): Confirm = the sheet's
                  ONE commit action → SupprButton variant="primary" (solid
                  aubergine pill). Cancel = secondary sibling → variant="ghost".
                  The flex 1 / 2 split is preserved as a layout-only override. */}
              <SupprButton
                variant="ghost"
                accessibilityLabel="Cancel"
                onPress={onClose}
                disabled={saving}
                testID="goal-pace-retune-cancel"
                label="Cancel"
                style={{ flex: 1 }}
              />
              <SupprButton
                variant="primary"
                accessibilityLabel="Confirm new pace"
                onPress={handleConfirm}
                disabled={saving || !preview}
                loading={saving}
                testID="goal-pace-retune-confirm"
                label="Confirm"
                style={{ flex: 2 }}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default GoalPaceRetuneSheet;
