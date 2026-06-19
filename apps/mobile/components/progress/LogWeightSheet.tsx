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
import { supabase } from "@/lib/supabase";
import { refreshAdaptiveTdeeForUser } from "@/lib/refreshAdaptiveTdee";
import { kgToLb, lbToKg } from "@suppr/shared/units/imperial";
import { isNewWeightLow } from "@suppr/nutrition-core/weightWinMoment";

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

const MAX_JSONB_DAYS = 400;

function pruneByDay(map: Record<string, number>): Record<string, number> {
  const keys = Object.keys(map).sort().reverse().slice(0, MAX_JSONB_DAYS);
  const pruned: Record<string, number> = {};
  for (const k of keys) pruned[k] = map[k];
  return pruned;
}

function isoTodayKey(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Human label for an edit target, e.g. "5 May 2026". */
function editDateLabel(dateISO: string): string {
  const d = new Date(dateISO + "T00:00:00");
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Newest entry date in the by-day map, or null when empty. Used to decide
 * whether an edit should also update the scalar `weight_kg` ("latest weight"):
 * editing the most-recent weigh-in updates it; editing an older one must not
 * clobber the current weight.
 */
function newestDateKey(map: Record<string, number>): string | null {
  const keys = Object.entries(map)
    .filter(([, kg]) => Number.isFinite(kg) && kg > 0)
    .map(([k]) => k)
    .sort()
    .reverse();
  return keys[0] ?? null;
}

export interface LogWeightSheetProps {
  visible: boolean;
  onClose: () => void;
  userId: string | null;
  isImperial: boolean;
  weightKgByDay: Record<string, number>;
  weightKg: number | null;
  /**
   * ENG-748 #9 (2026-05-27) — edit-in-place target. When set, the sheet
   * edits the existing weigh-in on that date (value changes, date kept)
   * rather than logging a new entry for today. Pre-fills with the stored
   * value for that date. Null/undefined = the normal "log today" flow.
   */
  editDate?: string | null;
  onSaved: (next: {
    weightKgByDay: Record<string, number>;
    weightKg: number;
    /**
     * ENG-824 (Redesign — Design Direction 2026) — the just-saved weigh-in was
     * a new all-time low (strictly below the prior minimum). The parent uses
     * this to mount the reserved win-moment celebration. Always `false` when
     * `redesign_winmoment` is off, so the flag-off path stays inert.
     */
    isNewLow: boolean;
  }) => void;
}

export function LogWeightSheet({
  visible,
  onClose,
  userId,
  isImperial,
  weightKgByDay,
  weightKg,
  editDate,
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
    // ENG-824 (Redesign — Design Direction 2026): detect the new-all-time-low
    // landmark BEFORE the write, judging the saved kg against the prior map
    // (excluding the date being written so an edit isn't compared to itself).
    // Gated behind `redesign_winmoment`; flag-off keeps the silent save.
    const winMomentEnabled = isFeatureEnabled("redesign_winmoment");
    const newLow =
      winMomentEnabled &&
      isNewWeightLow({ savedKg: kg, priorByDay: weightKgByDay, targetDateKey: targetKey });
    const next = pruneByDay({ ...weightKgByDay, [targetKey]: kg });
    // The scalar `weight_kg` represents the latest weight. Only update it
    // when the edited/logged entry IS (or becomes) the newest dated entry —
    // editing an OLD weigh-in must not overwrite the current weight.
    const newest = newestDateKey(next);
    const touchesLatest = newest === targetKey;
    setSaving(true);
    const update: { weight_kg_by_day: Record<string, number>; weight_kg?: number } = {
      weight_kg_by_day: next,
    };
    if (touchesLatest) update.weight_kg = kg;
    const { error } = await supabase
      .from("profiles")
      .update(update)
      .eq("id", userId);
    setSaving(false);
    if (error) {
      Alert.alert(
        isEditing ? "Couldn't update weight" : "Couldn't save weight",
        error.message ?? "Try again.",
      );
      return;
    }
    // Fire-and-forget — TDEE re-learn pulls from the fresh log.
    void refreshAdaptiveTdeeForUser(supabase, userId);
    // ENG-824 — quiet <100ms confirm on every save; a loud success
    // notification is RESERVED for the new-low landmark (the parent plays the
    // WinMomentPlayer on the same beat). Both behind `redesign_winmoment`;
    // flag-off fires neither, preserving today's silent weigh-in.
    if (winMomentEnabled) {
      if (newLow) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    }
    onSaved({
      weightKgByDay: next,
      // Report the scalar the parent should show: the latest weight after the
      // write. If we edited the latest entry that's `kg`; otherwise it's the
      // existing newest value (unchanged).
      weightKg: touchesLatest ? kg : (newest ? next[newest] : kg),
      isNewLow: newLow,
    });
    onClose();
  }, [input, isImperial, userId, weightKgByDay, editDate, isEditing, onSaved, onClose]);

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
            <View style={[styles.grabber, { backgroundColor: colors.border }]} />
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
    fontSize: 12,
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
