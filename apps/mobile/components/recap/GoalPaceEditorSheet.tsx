/**
 * GoalPaceEditorSheet — post-onboarding "Edit goal & pace" editor (mobile).
 *
 * The onboarding pace step promises "You can change this anytime", but
 * until now there was no surface to do so outside the weekly check-in.
 * The Targets screen's Edit action dead-ended at `/profile` (a manual
 * macro editor with no goal control). This sheet closes that gap
 * (ENG goal-editor, 2026-05-25).
 *
 * It is the mobile twin of `src/app/components/suppr/goal-pace-editor-dialog.tsx`
 * and reuses the visual language of `GoalPaceRetuneSheet.tsx` (the weekly
 * check-in sheet). Differences from the retune sheet:
 *   - Lets the user change GOAL TYPE (lose / maintain / gain), not just
 *     pace within a fixed goal.
 *   - Adds a goal-weight field (projections only — never recomputes
 *     calories).
 *   - Uses the STATIC formula (`recomputeTargetsFromProfile`) to match
 *     the Settings activity-level precedent, NOT the adaptive retune path.
 *   - Persists via the shared `persistRecomputedTargets` helper so the
 *     web + mobile write sequence is identical.
 *
 * Posture rules (locked by nutrition-engine spec):
 *   - Goal/pace change → recompute target_calories + ALL FOUR macros,
 *     stamp `target_calories_source = "recompute"`.
 *   - goal_weight_kg change → write the column only.
 *   - If both change in one save, recompute only when goal/pace moved.
 *   - goal → maintain clears plan_pace.
 *   - Safety floor is soft-warn-not-block.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Check, X } from "lucide-react-native";

import { Accent, Radius, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { supabase } from "@/lib/supabase";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import {
  recomputeTargetsFromProfile,
  type RecomputedTargets,
} from "@suppr/shared/nutrition/recomputeTargetsForActivity";
import { persistRecomputedTargets } from "@suppr/shared/nutrition/persistRecomputedTargets";
import { safetyFloorFor } from "@suppr/shared/onboarding/targets";
import {
  PACE_LABELS,
  type ActivityLevel,
  type NutritionStrategy,
  type PlanPace,
  type Sex,
} from "@suppr/shared/nutrition/tdee";
import { kgToLb, lbToKg } from "@suppr/shared/units/imperial";

type DbGoal = "cut" | "maintain" | "bulk";

const GOAL_OPTIONS: { value: DbGoal; label: string; desc: string }[] = [
  { value: "cut", label: "Lose weight", desc: "Eat in a deficit" },
  { value: "maintain", label: "Maintain", desc: "Hold your weight" },
  { value: "bulk", label: "Gain weight", desc: "Eat in a surplus" },
];

const PACE_OPTIONS: PlanPace[] = ["relaxed", "steady", "accelerated", "vigorous"];

function normalizeGoal(raw: string | null): DbGoal {
  if (raw === "maintain" || raw === "health") return "maintain";
  if (raw === "bulk" || raw === "gain" || raw === "strength") return "bulk";
  return "cut";
}

export interface GoalPaceEditorSheetProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  /** Called after a successful save so the parent can reload its live
   *  target_calories (mirrors GoalPaceRetuneSheet's onSaved). */
  onSaved?: () => void;
}

type LoadedProfile = {
  sex: Sex;
  weightKg: number | null;
  heightCm: number | null;
  age: number | null;
  activityLevel: ActivityLevel;
  goal: DbGoal;
  planPace: PlanPace;
  goalWeightKg: number | null;
  nutritionStrategy: NutritionStrategy | null;
  measurementSystem: "metric" | "imperial";
};

export function GoalPaceEditorSheet(props: GoalPaceEditorSheetProps) {
  const colors = useThemeColors();
  const { visible, onClose, userId, onSaved } = props;

  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState<LoadedProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [goal, setGoal] = useState<DbGoal>("cut");
  const [planPace, setPlanPace] = useState<PlanPace>("steady");
  const [goalWeightInput, setGoalWeightInput] = useState("");

  useEffect(() => {
    if (!visible || !userId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSaving(false);
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select(
          "sex, age, weight_kg, height_cm, activity_level, goal, plan_pace, goal_weight_kg, nutrition_strategy, measurement_system",
        )
        .eq("id", userId)
        .maybeSingle();
      if (cancelled) return;
      const row = (data ?? {}) as Record<string, unknown>;
      const sex: Sex =
        row.sex === "male" || row.sex === "female" ? row.sex : "unspecified";
      const w = typeof row.weight_kg === "number" ? row.weight_kg : null;
      const h = typeof row.height_cm === "number" ? row.height_cm : null;
      const a = typeof row.age === "number" ? row.age : null;
      const al: ActivityLevel =
        row.activity_level === "sedentary" ||
        row.activity_level === "light" ||
        row.activity_level === "moderate" ||
        row.activity_level === "active" ||
        row.activity_level === "very_active"
          ? row.activity_level
          : "moderate";
      const g = normalizeGoal(typeof row.goal === "string" ? row.goal : null);
      const pp =
        row.plan_pace === "relaxed" ||
        row.plan_pace === "steady" ||
        row.plan_pace === "accelerated" ||
        row.plan_pace === "vigorous"
          ? (row.plan_pace as PlanPace)
          : "steady";
      const gw = typeof row.goal_weight_kg === "number" ? row.goal_weight_kg : null;
      const ns =
        row.nutrition_strategy === "balanced" ||
        row.nutrition_strategy === "high_protein" ||
        row.nutrition_strategy === "high_satisfaction" ||
        row.nutrition_strategy === "low_carb"
          ? (row.nutrition_strategy as NutritionStrategy)
          : null;
      const ms = row.measurement_system === "imperial" ? "imperial" : "metric";

      setLoaded({
        sex,
        weightKg: w,
        heightCm: h,
        age: a,
        activityLevel: al,
        goal: g,
        planPace: pp,
        goalWeightKg: gw,
        nutritionStrategy: ns,
        measurementSystem: ms,
      });
      setGoal(g);
      setPlanPace(pp);
      setGoalWeightInput(
        gw == null
          ? ""
          : ms === "imperial"
            ? String(Math.round(kgToLb(gw) * 10) / 10)
            : String(Math.round(gw * 10) / 10),
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, userId]);

  const weightUnit = loaded?.measurementSystem === "imperial" ? "lb" : "kg";

  const goalWeightKg = useMemo<number | null>(() => {
    const t = goalWeightInput.trim();
    if (t === "") return null;
    const n = Number(t);
    if (!Number.isFinite(n) || n <= 0) return null;
    return loaded?.measurementSystem === "imperial"
      ? Math.round(lbToKg(n) * 10) / 10
      : Math.round(n * 10) / 10;
  }, [goalWeightInput, loaded?.measurementSystem]);

  const goalOrPaceChanged = useMemo(() => {
    if (!loaded) return false;
    if (goal !== loaded.goal) return true;
    if (goal === "maintain") return false;
    return planPace !== loaded.planPace;
  }, [loaded, goal, planPace]);

  const goalWeightChanged = useMemo(() => {
    if (!loaded) return false;
    const a = loaded.goalWeightKg;
    if (a == null && goalWeightKg == null) return false;
    if (a == null || goalWeightKg == null) return true;
    return Math.abs(a - goalWeightKg) > 0.05;
  }, [loaded, goalWeightKg]);

  const dirty = goalOrPaceChanged || goalWeightChanged;

  const preview = useMemo<RecomputedTargets | null>(() => {
    if (!loaded || !goalOrPaceChanged) return null;
    if (loaded.weightKg == null || loaded.heightCm == null || loaded.age == null) {
      return null;
    }
    return recomputeTargetsFromProfile({
      sex: loaded.sex,
      weightKg: loaded.weightKg,
      heightCm: loaded.heightCm,
      age: loaded.age,
      activityLevel: loaded.activityLevel,
      goal,
      planPace: goal === "maintain" ? null : planPace,
      nutritionStrategy: loaded.nutritionStrategy,
    });
  }, [loaded, goal, planPace, goalOrPaceChanged]);

  const belowSafetyFloor =
    preview != null &&
    goal === "cut" &&
    preview.target_calories < safetyFloorFor(loaded?.sex ?? null);

  const handleConfirm = useCallback(async () => {
    if (!dirty || saving || !loaded || !userId) {
      onClose();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const profileUpdate: Record<string, unknown> = {};
      if (goal !== loaded.goal) profileUpdate.goal = goal;
      if (goal === "maintain") {
        if (loaded.goal !== "maintain") profileUpdate.plan_pace = null;
      } else if (goalOrPaceChanged) {
        profileUpdate.plan_pace = planPace;
      }
      if (goalWeightChanged) profileUpdate.goal_weight_kg = goalWeightKg;

      const recomputed = goalOrPaceChanged ? preview : null;

      const result = await persistRecomputedTargets(supabase, userId, {
        profileUpdate,
        recomputed,
        source: "recompute",
      });

      if (!result.ok) {
        setError("Couldn't save your goal. Please try again.");
        setSaving(false);
        return;
      }

      try {
        track(AnalyticsEvents.goal_pace_adjusted, {
          previousGoal: loaded.goal,
          newGoal: goal,
          previousPlanPace: loaded.planPace,
          newPlanPace: goal === "maintain" ? null : planPace,
          goalWeightChanged,
          recomputed: recomputed != null,
          newTargetKcal: recomputed?.target_calories ?? null,
          belowSafetyFloor,
          surface: "settings_targets",
        });
      } catch {
        /* fire-and-forget */
      }

      setSaving(false);
      onSaved?.();
      onClose();
    } catch {
      setError("Couldn't save your goal. Please try again.");
      setSaving(false);
    }
  }, [
    dirty,
    saving,
    loaded,
    userId,
    goal,
    planPace,
    goalOrPaceChanged,
    goalWeightChanged,
    goalWeightKg,
    preview,
    belowSafetyFloor,
    onSaved,
    onClose,
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
      testID="goal-pace-editor-sheet"
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
            borderTopLeftRadius: Radius.xl,
            borderTopRightRadius: Radius.xl,
            paddingTop: Spacing.lg,
            paddingHorizontal: Spacing.xl,
            paddingBottom: Spacing.xxxl,
            maxHeight: "88%",
          }}
        >
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
              Edit goal &amp; pace
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              hitSlop={10}
              testID="goal-pace-editor-close"
            >
              <X size={24} color={colors.textSecondary} />
            </Pressable>
          </View>

          {loading ? (
            <View style={{ paddingVertical: Spacing.xxxl, alignItems: "center" }}>
              <ActivityIndicator color={Accent.primary} />
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: Spacing.lg }}
            >
              {/* Goal type */}
              {sectionLabel("Goal")}
              <View
                style={{ gap: Spacing.sm, marginBottom: Spacing.lg }}
                testID="goal-pace-editor-goal-options"
              >
                {GOAL_OPTIONS.map((opt) => {
                  const selected = goal === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      accessibilityRole="button"
                      accessibilityLabel={`${opt.label} — ${selected ? "selected" : "tap to select"}`}
                      onPress={() => setGoal(opt.value)}
                      testID={`goal-option-${opt.value}`}
                      style={{
                        paddingVertical: Spacing.md,
                        paddingHorizontal: Spacing.md,
                        borderRadius: Radius.md,
                        borderWidth: 1.5,
                        borderColor: selected ? Accent.primary : colors.cardBorder,
                        backgroundColor: selected ? `${Accent.primary}10` : colors.card,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 15,
                            fontWeight: selected ? "700" : "500",
                            color: selected ? colors.text : colors.textSecondary,
                          }}
                        >
                          {opt.label}
                        </Text>
                        <Text
                          style={{
                            fontSize: 12,
                            color: colors.textTertiary,
                            marginTop: 2,
                          }}
                        >
                          {opt.desc}
                        </Text>
                      </View>
                      {selected ? <Check size={18} color={Accent.primary} /> : null}
                    </Pressable>
                  );
                })}
              </View>

              {/* Pace — hidden on maintain */}
              {goal !== "maintain" ? (
                <>
                  {sectionLabel("Pace")}
                  <View
                    style={{ gap: Spacing.sm, marginBottom: Spacing.lg }}
                    testID="goal-pace-editor-pace-options"
                  >
                    {PACE_OPTIONS.map((p) => {
                      const selected = planPace === p;
                      return (
                        <Pressable
                          key={p}
                          accessibilityRole="button"
                          accessibilityLabel={`${PACE_LABELS[p].title} — ${selected ? "selected" : "tap to select"}`}
                          onPress={() => setPlanPace(p)}
                          testID={`pace-option-${p}`}
                          style={{
                            paddingVertical: Spacing.md,
                            paddingHorizontal: Spacing.md,
                            borderRadius: Radius.md,
                            borderWidth: 1.5,
                            borderColor: selected ? Accent.primary : colors.cardBorder,
                            backgroundColor: selected ? `${Accent.primary}10` : colors.card,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                fontSize: 15,
                                fontWeight: selected ? "700" : "500",
                                color: selected ? colors.text : colors.textSecondary,
                              }}
                            >
                              {PACE_LABELS[p].title}
                            </Text>
                            <Text
                              style={{
                                fontSize: 12,
                                color: colors.textTertiary,
                                marginTop: 2,
                              }}
                            >
                              {PACE_LABELS[p].desc}
                            </Text>
                          </View>
                          {selected ? <Check size={18} color={Accent.primary} /> : null}
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}

              {/* Goal weight */}
              {sectionLabel(`Goal weight (${weightUnit})`)}
              <TextInput
                value={goalWeightInput}
                onChangeText={setGoalWeightInput}
                keyboardType="decimal-pad"
                placeholder={`Target weight in ${weightUnit}`}
                placeholderTextColor={colors.textTertiary}
                testID="goal-weight-input"
                style={{
                  borderWidth: 1.5,
                  borderColor: colors.cardBorder,
                  borderRadius: Radius.md,
                  paddingVertical: Spacing.md,
                  paddingHorizontal: Spacing.md,
                  fontSize: 15,
                  color: colors.text,
                  backgroundColor: colors.card,
                  marginBottom: Spacing.xs,
                }}
              />
              <Text
                style={{
                  fontSize: 12,
                  color: colors.textTertiary,
                  marginBottom: Spacing.lg,
                  lineHeight: 17,
                }}
              >
                Used for your projected reach-date only — it doesn&apos;t change
                your calorie target.
              </Text>

              {/* Live preview */}
              {preview ? (
                <View
                  testID="goal-pace-editor-preview"
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: Radius.lg,
                    borderWidth: 1,
                    borderColor: colors.cardBorder,
                    padding: Spacing.lg,
                    marginBottom: Spacing.md,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 22,
                      fontWeight: "700",
                      color: colors.text,
                      fontVariant: ["tabular-nums"],
                      marginBottom: 4,
                    }}
                  >
                    {preview.target_calories.toLocaleString()} kcal
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: colors.textTertiary,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    Protein {preview.target_protein}g · Carbs {preview.target_carbs}g
                    · Fat {preview.target_fat}g · Fibre {preview.target_fiber_g}g
                  </Text>
                </View>
              ) : null}

              {/* Soft-warn below safety floor */}
              {belowSafetyFloor ? (
                <View
                  testID="goal-pace-editor-safety-warn"
                  style={{
                    backgroundColor: `${Accent.warning}14`,
                    borderRadius: Radius.md,
                    borderWidth: 1,
                    borderColor: `${Accent.warning}40`,
                    padding: Spacing.md,
                    marginBottom: Spacing.md,
                  }}
                >
                  <Text style={{ fontSize: 13, color: colors.text, lineHeight: 19 }}>
                    This pace lands below the general safety floor for unsupervised
                    dieting. Consider a gentler pace, or check in with a clinician.
                  </Text>
                </View>
              ) : null}

              {error ? (
                <View style={{ marginBottom: Spacing.md }}>
                  <Text style={{ fontSize: 13, color: colors.text, lineHeight: 19 }}>
                    {error}
                  </Text>
                </View>
              ) : null}

              {/* CTAs */}
              <View
                style={{ flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.sm }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                  onPress={onClose}
                  disabled={saving}
                  testID="goal-pace-editor-cancel"
                  style={{
                    flex: 1,
                    paddingVertical: Spacing.md,
                    borderRadius: Radius.md,
                    borderWidth: 1.5,
                    borderColor: colors.cardBorder,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: saving ? 0.5 : 1,
                  }}
                >
                  <Text style={{ fontSize: 15, fontWeight: "600", color: colors.text }}>
                    Cancel
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Save goal and pace"
                  onPress={handleConfirm}
                  disabled={saving || !dirty}
                  testID="goal-pace-editor-save"
                  style={{
                    flex: 2,
                    paddingVertical: Spacing.md,
                    borderRadius: Radius.md,
                    backgroundColor: Accent.primary,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: saving || !dirty ? 0.5 : 1,
                  }}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>
                      Save
                    </Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

export default GoalPaceEditorSheet;
