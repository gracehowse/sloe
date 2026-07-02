import * as React from "react";
import { SHEET_RADIUS } from "@/components/ui/SupprCard";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { X } from "lucide-react-native";

import { FontFamily, IconSize, Radius, Spacing, Type } from "@/constants/theme";
import { SupprButton } from "@/components/ui/SupprButton";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { isFeatureEnabled } from "@/lib/analytics";
import { kgToLb, lbToKg } from "@suppr/shared/units/imperial";
import { resolveWeightSaveCelebration } from "@suppr/nutrition-core/weightWinMoment";
import { isoTodayKey, editDateLabel } from "./logWeightSheetDates";

/**
 * Weight chart consolidation Phase 1 (2026-05-11, B6 / F-132).
 *
 * Inline log-weight sheet mounted on the Progress tab so the 4 CTAs
 * (header Scale icon, Trend tile tap, sparse-state Log weight button,
 * Weight Journey card tap) no longer need to push the standalone
 * `/weight-tracker` route. Phase 3 deletes the route entirely once
 * Phase 2 migrates the remaining surfaces (steps drill, water, body
 * fat). See `docs/decisions/2026-05-11-weight-chart-consolidation-plan.md`.
 *
 * Logic mirrors `apps/mobile/app/weight-tracker.tsx` `saveWeight` —
 * the same optimistic-update + restore-on-error pattern, the same
 * adaptive-TDEE refresh on persist, the same 400-day JSONB prune.
 */

export interface LogWeightSheetProps {
  visible: boolean;
  onClose: () => void;
  userId: string | null;
  isImperial: boolean;
  weightKgByDay: Record<string, number>;
  weightKg: number | null;
  /**
   * ENG-952 — the user's goal weight (kg), or null when no goal is set.
   * Drives the milestone-crossing detection (the quieter second celebration
   * tier). Milestones are undefined without a goal, so a null goal never fires.
   */
  goalKg?: number | null;
  /**
   * ENG-748 #9 (2026-05-27) — edit-in-place target. When set, the sheet
   * edits the existing weigh-in on that date (value changes, date kept)
   * rather than logging a new entry for today. Pre-fills with the stored
   * value for that date. Null/undefined = the normal "log today" flow.
   */
  editDate?: string | null;
  onSaveWeight: (
    kg: number,
    dateKey: string,
  ) => Promise<{
    weightKgByDay: Record<string, number>;
    weightKg: number | null;
  }>;
  onSaved: (next: {
    weightKgByDay: Record<string, number>;
    weightKg: number | null;
    /**
     * ENG-824 (Redesign — Design Direction 2026) — the just-saved weigh-in was
     * a new all-time low (strictly below the prior minimum). The parent uses
     * this to mount the reserved win-moment celebration. Always `false` when
     * `redesign_winmoment` is off, so the flag-off path stays inert.
     */
    isNewLow: boolean;
    /**
     * ENG-952 — the just-saved weigh-in crossed into a new milestone band (1–9)
     * between the journey start and goal, and was NOT a new all-time low. The
     * parent uses this to fire the QUIETER second celebration tier. `null` when
     * no milestone was crossed, when the save was a new low (the loud tier owns
     * that beat), or when `progress_milestone_celebration_v1` is off — so the
     * flag-off path stays inert.
     */
    milestoneCrossed: number | null;
  }) => void;
}

export function LogWeightSheet({
  visible,
  onClose,
  userId,
  isImperial,
  weightKgByDay,
  weightKg,
  goalKg,
  editDate,
  onSaveWeight,
  onSaved,
}: LogWeightSheetProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [input, setInput] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const isEditing = Boolean(editDate);

  React.useEffect(() => {
    if (visible) {
      // In edit mode pre-fill with the stored value for the target date so
      // the user nudges from the mistyped figure; otherwise pre-fill with
      // the current weight (mirrors the /weight-tracker prefill behaviour).
      const seedKg = editDate ? weightKgByDay[editDate] : weightKg;
      const display = seedKg
        ? isImperial
          ? `${Math.round(kgToLb(seedKg) * 10) / 10}`
          : `${Math.round(seedKg * 10) / 10}`
        : "";
      setInput(display);
    }
  }, [visible, weightKg, isImperial, editDate, weightKgByDay]);

  const handleSave = React.useCallback(async () => {
    if (!userId) return;
    const v = Number.parseFloat(input.replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) {
      Alert.alert(
        "Enter a valid weight",
        `Type a number greater than zero in ${isImperial ? "pounds" : "kilograms"}.`,
      );
      return;
    }
    const kg = isImperial ? lbToKg(v) : v;
    // ENG-748 #9 — write to the edited date when editing, else today's key.
    const targetKey = editDate ?? isoTodayKey();
    // ENG-824 / ENG-952 — resolve the celebration tier BEFORE the write,
    // judging the saved kg against the prior map (excluding the date being
    // written so an edit isn't compared to itself). The loud new-all-time-low
    // owns precedence over the quieter milestone tier; the shared resolver keeps
    // that decision identical to web. Each tier is flag-gated
    // (`redesign_winmoment` / `progress_milestone_celebration_v1`); flag-off
    // keeps the silent save.
    const winMomentEnabled = isFeatureEnabled("redesign_winmoment");
    const milestoneEnabled = isFeatureEnabled("progress_milestone_celebration_v1");
    const celebration = resolveWeightSaveCelebration({
      savedKg: kg,
      priorByDay: weightKgByDay,
      targetDateKey: targetKey,
      goalKg: goalKg ?? null,
      winMomentEnabled,
      milestoneEnabled,
    });
    const newLow = celebration.isNewLow;
    const milestoneCrossed = celebration.milestoneOrdinal;
    setSaving(true);
    let saved: {
      weightKgByDay: Record<string, number>;
      weightKg: number | null;
    };
    try {
      saved = await onSaveWeight(kg, targetKey);
    } catch (error) {
      setSaving(false);
      Alert.alert(
        isEditing ? "Couldn't update weight" : "Couldn't save weight",
        error instanceof Error ? error.message : "Try again.",
      );
      return;
    }
    setSaving(false);
    // ENG-824 — quiet <100ms confirm on every save; a loud success
    // notification is RESERVED for the new-low landmark (the parent plays the
    // WinMomentPlayer on the same beat). Both behind `redesign_winmoment`;
    // flag-off fires neither, preserving today's silent weigh-in.
    if (winMomentEnabled || milestoneEnabled) {
      if (newLow) {
        // Loud landmark — the reserved success notification.
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
      } else if (milestoneCrossed != null) {
        // ENG-952 — quieter milestone tier: a soft Light tap, not the loud
        // Success notification reserved for a new all-time low.
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    }
    onSaved({
      weightKgByDay: saved.weightKgByDay,
      weightKg: saved.weightKg,
      isNewLow: newLow,
      milestoneCrossed,
    });
    onClose();
  }, [
    input,
    isImperial,
    userId,
    weightKgByDay,
    goalKg,
    editDate,
    isEditing,
    onSaveWeight,
    onSaved,
    onClose,
  ]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.kbWrap}
        pointerEvents="box-none"
      >
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              paddingBottom: insets.bottom + Spacing.lg,
            },
          ]}
          testID="log-weight-sheet"
        >
          <View style={styles.handleRow}>
            <View
              style={[styles.grabber, { backgroundColor: colors.border }]}
            />
          </View>
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: colors.text }]}>
              {isEditing ? "Edit weigh-in" : "Log your weight"}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityLabel="Close"
              testID="log-weight-sheet-close"
            >
              <X size={IconSize.md} color={colors.textSecondary} />
            </Pressable>
          </View>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {isEditing && editDate
              ? `Correcting your weigh-in for ${editDateLabel(editDate)}. We'll re-learn your TDEE from the update.`
              : "Today's weight. We'll re-learn your TDEE from the update."}
          </Text>
          <View
            style={[
              styles.inputWrap,
              {
                backgroundColor: colors.inputBg,
                borderColor: colors.border,
              },
            ]}
          >
            <TextInput
              testID="log-weight-input"
              value={input}
              onChangeText={setInput}
              keyboardType="decimal-pad"
              placeholder={isImperial ? "e.g. 165.4" : "e.g. 75.0"}
              placeholderTextColor={colors.textTertiary}
              autoFocus
              style={[styles.input, { color: colors.text }]}
            />
            <Text style={[styles.unit, { color: colors.textSecondary }]}>
              {isImperial ? "lb" : "kg"}
            </Text>
          </View>
          {/* DC12 (2026-05-14, premium-bar audit) — Headspace-style
              supportive moment-of-truth line. Weigh-ins are a
              high-emotion surface (scale numbers carry weight, no
              pun intended); the linear "Save weight" CTA is honest
              but cold. This subtle line reframes the act as data
              that helps the user, not a verdict on them. Mirrors
              `today-first-meal-empty-state` / `progress-headline`
              voice rule from `_project-context.md`. */}
          <Text
            testID="log-weight-supportive-copy"
            style={[styles.supportiveCopy, { color: colors.textSecondary }]}
          >
            Every check-in gives us better data for you.
          </Text>
          {/* Save weight — primary (button-system canon, 2026-06-12): the
              sheet's one main commit. SupprButton owns the loading spinner +
              disabled dim. */}
          <SupprButton
            variant="primary"
            onPress={handleSave}
            disabled={!input.trim()}
            loading={saving}
            testID="log-weight-save"
            label={isEditing ? "Update weigh-in" : "Save weight"}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    // 2026-05-15 — RN 0.85 forward-compat: `StyleSheet.absoluteFillObject`
    // (a spreadable object) was removed; `StyleSheet.absoluteFill` exists
    // but is a registered numeric ID, so can't be spread into a
    // StyleSheet.create entry. Inline the literal.
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  kbWrap: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
  },
  handleRow: {
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: Type.title,
  subtitle: {
    ...Type.body,
    marginTop: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.sm,
  },
  supportiveCopy: {
    ...Type.captionSmall,
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  // SLOE Phase 0: the weight-entry hero numeral reads in Newsreader serif
  // (big numerals are a serif moment); the kg/lb unit beside it stays sans.
  // Family carries the weight, so the sans `fontWeight: 600` is dropped.
  input: {
    flex: 1,
    fontFamily: FontFamily.serifRegular,
    fontSize: 28,
  },
  unit: {
    ...Type.body,
    marginLeft: Spacing.sm,
  },
});
