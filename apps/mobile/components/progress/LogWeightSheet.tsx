import * as React from "react";
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
import { X } from "lucide-react-native";

import { Accent, IconSize, Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { supabase } from "@/lib/supabase";
import { refreshAdaptiveTdeeForUser } from "@/lib/refreshAdaptiveTdee";
import { kgToLb, lbToKg } from "../../../../src/lib/units/imperial";

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

export interface LogWeightSheetProps {
  visible: boolean;
  onClose: () => void;
  userId: string | null;
  isImperial: boolean;
  weightKgByDay: Record<string, number>;
  weightKg: number | null;
  onSaved: (next: {
    weightKgByDay: Record<string, number>;
    weightKg: number;
  }) => void;
}

export function LogWeightSheet({
  visible,
  onClose,
  userId,
  isImperial,
  weightKgByDay,
  weightKg,
  onSaved,
}: LogWeightSheetProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [input, setInput] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (visible) {
      // Pre-populate with the current weight so the user can nudge up/down
      // rather than retyping. Mirrors the /weight-tracker prefill behaviour.
      const display = weightKg
        ? isImperial
          ? `${Math.round(kgToLb(weightKg) * 10) / 10}`
          : `${Math.round(weightKg * 10) / 10}`
        : "";
      setInput(display);
    }
  }, [visible, weightKg, isImperial]);

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
    const todayKey = isoTodayKey();
    const next = pruneByDay({ ...weightKgByDay, [todayKey]: kg });
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ weight_kg: kg, weight_kg_by_day: next })
      .eq("id", userId);
    setSaving(false);
    if (error) {
      Alert.alert("Couldn't save weight", error.message ?? "Try again.");
      return;
    }
    // Fire-and-forget — TDEE re-learn pulls from the fresh log.
    void refreshAdaptiveTdeeForUser(supabase, userId);
    onSaved({ weightKgByDay: next, weightKg: kg });
    onClose();
  }, [input, isImperial, userId, weightKgByDay, onSaved, onClose]);

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
              Log your weight
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
            Today&apos;s weight. We&apos;ll re-learn your TDEE from the
            update.
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
          <Pressable
            onPress={handleSave}
            disabled={saving || !input.trim()}
            style={[
              styles.cta,
              {
                backgroundColor: Accent.primary,
                opacity: saving || !input.trim() ? 0.5 : 1,
              },
            ]}
            testID="log-weight-save"
          >
            <Text style={styles.ctaLabel}>
              {saving ? "Saving..." : "Save weight"}
            </Text>
          </Pressable>
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
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
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
  input: {
    flex: 1,
    fontSize: 28,
    fontWeight: "600",
  },
  unit: {
    ...Type.body,
    marginLeft: Spacing.sm,
  },
  cta: {
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    alignItems: "center",
  },
  ctaLabel: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
