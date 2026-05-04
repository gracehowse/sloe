/**
 * Move meal bottom sheet (Batch 3.10 — mobile parity, 2026-04-18 audit C2).
 *
 * Mobile parity for web MealPlanner's drag-drop + keyboard "Move" fallback.
 * Shows a 7-day x slot grid of every cell in the current week with the source
 * cell marked, and fires the shared `moveMealInPlan` helper on tap.
 *
 * Does no I/O — callers hand in the plan, start cell, and onMove callback.
 * Two-way swap semantics come from the shared helper; this file never
 * duplicates that logic.
 */
import { useMemo } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Accent, Radius, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import type { DayPlan } from "../../../src/types/recipe";

type Props = {
  visible: boolean;
  onClose: () => void;
  plan: DayPlan[] | null;
  /** Source cell — the meal the user long-pressed. Day is 1-indexed. */
  from: { day: number; slotIndex: number } | null;
  /**
   * Labels for the day columns, aligned with plan[i] by index (plan.length).
   * Caller passes e.g. `["Mon", "Tue", ...]` so the sheet does no date math.
   */
  dayLabels: string[];
  onMove: (to: { day: number; slotIndex: number }) => void;
};

export function MoveMealSheet({
  visible,
  onClose,
  plan,
  from,
  dayLabels,
  onMove,
}: Props) {
  const colors = useThemeColors();

  // Every destination cell across the current week, flattened for a
  // top-to-bottom list. We keep it as a list rather than a 2D grid so the
  // sheet is readable on narrow phones and accessible via VoiceOver row-by-row.
  const rows = useMemo(() => {
    if (!plan) return [];
    const out: {
      day: number;
      slotIndex: number;
      dayLabel: string;
      slotName: string;
      recipeTitle: string;
      isSource: boolean;
      isEmpty: boolean;
    }[] = [];
    plan.forEach((dp, di) => {
      const dayLabel = dayLabels[di] ?? `Day ${dp.day}`;
      dp.meals.forEach((m, si) => {
        out.push({
          day: dp.day,
          slotIndex: si,
          dayLabel,
          slotName: m.name,
          recipeTitle: m.recipeTitle ?? "",
          isSource: !!from && from.day === dp.day && from.slotIndex === si,
          isEmpty: !!m.isPlaceholder || !m.recipeTitle,
        });
      });
    });
    return out;
  }, [plan, dayLabels, from]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityLabel="Close move meal"
      />
      <View
        style={[
          styles.sheet,
          { backgroundColor: colors.card, borderColor: colors.cardBorder },
        ]}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text }]}>Move meal</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Pick a slot
            </Text>
          </View>
          <Pressable onPress={onClose} accessibilityLabel="Cancel">
            <Text style={{ color: Accent.primary, fontWeight: "600" }}>Cancel</Text>
          </Pressable>
        </View>

        <ScrollView
          style={{ maxHeight: 480 }}
          contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl }}
        >
          {rows.length === 0 ? (
            <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
              No slots available.
            </Text>
          ) : (
            rows.map((r) => {
              const key = `${r.day}-${r.slotIndex}`;
              const label = `Move to ${r.dayLabel} ${r.slotName}`;
              return (
                <Pressable
                  key={key}
                  disabled={r.isSource}
                  onPress={() => onMove({ day: r.day, slotIndex: r.slotIndex })}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityState={{ disabled: r.isSource }}
                  style={[
                    styles.row,
                    {
                      backgroundColor: r.isSource
                        ? Accent.primary + "12"
                        : colors.background,
                      borderColor: r.isSource ? Accent.primary : colors.cardBorder,
                      opacity: r.isSource ? 0.8 : 1,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: r.isSource ? Accent.primary : colors.text,
                        fontWeight: "700",
                        fontSize: 13,
                      }}
                      numberOfLines={1}
                    >
                      {r.dayLabel} · {r.slotName}
                    </Text>
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontSize: 12,
                        marginTop: 2,
                      }}
                      numberOfLines={1}
                    >
                      {r.isEmpty ? "Empty slot" : r.recipeTitle}
                    </Text>
                  </View>
                  {r.isSource ? (
                    <Text
                      style={{
                        color: Accent.primary,
                        fontSize: 11,
                        fontWeight: "700",
                        letterSpacing: 0.5,
                      }}
                    >
                      FROM
                    </Text>
                  ) : null}
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  title: { fontSize: 18, fontWeight: "700" },
  subtitle: { fontSize: 13, marginTop: 2 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    // Audit M6 (2026-04-18): list-row card-shell uses Radius.lg.
    borderRadius: Radius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
});

export default MoveMealSheet;
