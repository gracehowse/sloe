/**
 * GoalPaceEditorSheet — post-onboarding "Edit goal & pace" editor (mobile).
 *
 * The onboarding pace step promises "You can change this anytime", but
 * until now there was no surface to do so outside the weekly check-in.
 * The Targets screen's Edit action dead-ended at `/profile` (a manual
 * macro editor with no goal control). This sheet closes that gap
 * (ENG goal-editor, 2026-05-25).
 *
 * It is the mobile twin of `src/app/components/suppr/goal-pace-editor-dialog.tsx`.
 *
 * ── Stage 2 (target-recompute unification, 2026-05-26) ───────────────
 * All load / derive / persist logic lives in `useGoalPaceEditor`
 * (composition-root hook) so this file is a thin presentation shell
 * under the 400-line limit (ENG-621). Subcomponents:
 *   - `GoalOptionList` / `GoalPaceFooter` — `GoalPaceControls.tsx`
 *   - `GoalPaceSlider` — continuous kg/week slider (onboarding parity)
 *   - `GoalPaceBodyFields` — editable current-weight + height
 *
 * Behaviour that landed with the hook:
 *   - ADAPTIVE maintenance for the live preview (adaptive_tdee when
 *     confident + fresh, else static Mifflin).
 *   - CONTINUOUS pace slider seated from `pace_kg_per_week` (else
 *     inferred from the legacy `plan_pace` preset); dirty diffs against
 *     the seated continuous value so a no-op save never moves the target.
 *   - WEIGHT + HEIGHT editable here and fed into the recompute.
 *
 * Posture (unchanged): goal/pace/weight/height → recompute +
 * provenance "recompute"; goal-weight-only → column write; goal →
 * maintain clears pace; safety floor is soft-warn-not-block. Fibre /
 * manual macros stay on /profile — reachable via "Customise macros".
 */

import { useCallback } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { ChevronRight, SlidersHorizontal, X } from "lucide-react-native";

import { Accent, Radius, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

import { useGoalPaceEditor } from "./useGoalPaceEditor";
import { GoalPaceSlider } from "./GoalPaceSlider";
import { GoalPaceBodyFields } from "./GoalPaceBodyFields";
import { GoalOptionList, GoalPaceFooter } from "./GoalPaceControls";

export interface GoalPaceEditorSheetProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  /** Called after a successful save so the parent can reload its live
   *  target_calories (mirrors GoalPaceRetuneSheet's onSaved). */
  onSaved?: () => void;
}

export function GoalPaceEditorSheet(props: GoalPaceEditorSheetProps) {
  const colors = useThemeColors();
  const router = useRouter();
  const { visible, onClose, userId, onSaved } = props;

  const editor = useGoalPaceEditor({ visible, userId, onClose, onSaved });

  const goToManualMacros = useCallback(() => {
    onClose();
    router.push("/profile");
  }, [onClose, router]);

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
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}
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
              style={{ fontSize: 20, fontWeight: "700", color: colors.text, letterSpacing: -0.3 }}
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

          {editor.loading ? (
            <View style={{ paddingVertical: Spacing.xxxl, alignItems: "center" }}>
              <ActivityIndicator color={Accent.primary} />
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: Spacing.lg }}
              keyboardShouldPersistTaps="handled"
            >
              {/* Goal type */}
              {sectionLabel("Goal")}
              <GoalOptionList goal={editor.goal} onChange={editor.onChangeGoal} />

              {/* Pace — continuous slider, hidden on maintain */}
              {editor.goal !== "maintain" ? (
                <>
                  {sectionLabel("Pace")}
                  <GoalPaceSlider
                    value={editor.pace}
                    onChange={editor.setPace}
                    min={editor.sliderRange.min}
                    max={editor.sliderRange.max}
                    step={editor.sliderRange.step}
                    sliderGoal={editor.sliderGoal}
                  />
                </>
              ) : null}

              {/* Current weight + height */}
              <GoalPaceBodyFields
                measurementSystem={editor.measurementSystem}
                weightUnit={editor.weightUnit}
                weightInput={editor.weightInput}
                setWeightInput={editor.setWeightInput}
                heightCmInput={editor.heightCmInput}
                setHeightCmInput={editor.setHeightCmInput}
                heightFeetInput={editor.heightFeetInput}
                setHeightFeetInput={editor.setHeightFeetInput}
                heightInchesInput={editor.heightInchesInput}
                setHeightInchesInput={editor.setHeightInchesInput}
              />

              {/* Goal weight */}
              {sectionLabel(`Goal weight (${editor.weightUnit})`)}
              <TextInput
                value={editor.goalWeightInput}
                onChangeText={editor.setGoalWeightInput}
                keyboardType="decimal-pad"
                placeholder={`Target weight in ${editor.weightUnit}`}
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
                Used for your projected reach-date only — it doesn&apos;t change your
                calorie target.
              </Text>

              {/* Live preview (adaptive-aware) */}
              {editor.preview ? (
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
                    {editor.preview.target_calories.toLocaleString()} kcal
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: colors.textTertiary,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    Protein {editor.preview.target_protein}g · Carbs{" "}
                    {editor.preview.target_carbs}g · Fat {editor.preview.target_fat}g · Fibre{" "}
                    {editor.preview.target_fiber_g}g
                  </Text>
                </View>
              ) : null}

              {/* Soft-warn below safety floor */}
              {editor.belowSafetyFloor ? (
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
                    This pace lands below the general safety floor for unsupervised dieting.
                    Consider a gentler pace, or check in with a clinician.
                  </Text>
                </View>
              ) : null}

              {/* Customise macros (incl. fibre) → the manual /profile editor.
                  The goal editor recomputes macros from the goal/pace; the
                  fibre goal + per-macro overrides live on /profile. */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Customise macros including fibre"
                onPress={goToManualMacros}
                testID="goal-pace-editor-customise-macros"
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: Spacing.sm,
                  paddingVertical: Spacing.md,
                  paddingHorizontal: Spacing.md,
                  borderRadius: Radius.md,
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                  backgroundColor: colors.card,
                  marginBottom: Spacing.md,
                }}
              >
                <SlidersHorizontal size={16} color={colors.textSecondary} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>
                    Customise macros (incl. fibre)
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>
                    Set per-macro and fibre targets by hand
                  </Text>
                </View>
                <ChevronRight size={18} color={colors.textTertiary} />
              </Pressable>

              {editor.error ? (
                <View style={{ marginBottom: Spacing.md }}>
                  <Text style={{ fontSize: 13, color: colors.text, lineHeight: 19 }}>
                    {editor.error}
                  </Text>
                </View>
              ) : null}

              <GoalPaceFooter
                saving={editor.saving}
                dirty={editor.dirty}
                onCancel={onClose}
                onSave={editor.handleConfirm}
              />
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

export default GoalPaceEditorSheet;
