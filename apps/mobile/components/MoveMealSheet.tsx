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
import { SHEET_RADIUS } from "@/components/ui/SupprCard";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  Coffee,
  Cookie,
  Sun,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react-native";
import { withAlpha, Accent, Radius, SlotColors, Spacing, Type } from "@/constants/theme";
import { PressableScale } from "@/components/ui/PressableScale";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import type { DayPlan } from "../../../src/types/recipe";

// 2026-05-13 (premium-bar audit Plan Card 3 #1): leading slot glyphs
// on each destination row so the user can scan vertically by slot
// type instead of reading the slot-name string on every row. Same
// glyph set + per-slot tint as the canonical Today meal rows
// (`apps/mobile/components/today/TodayMealsSection.tsx`) so the
// pattern reads identically across surfaces.
const SLOT_ICON: Record<string, LucideIcon> = {
  Breakfast: Coffee,
  Lunch: Sun,
  Dinner: UtensilsCrossed,
  Snacks: Cookie,
  Snack: Cookie,
};
const SLOT_TINT: Record<string, string> = {
  Breakfast: SlotColors.breakfast,
  Lunch: SlotColors.lunch,
  Dinner: SlotColors.dinner,
  Snacks: SlotColors.snack,
  Snack: SlotColors.snack,
};
function resolveSlotGlyph(name: string): LucideIcon {
  return SLOT_ICON[name] ?? UtensilsCrossed;
}
function resolveSlotTint(name: string): string {
  return SLOT_TINT[name] ?? Accent.primary;
}

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
  // Secondary accent (Frost flag → damson, else clay) for the Cancel link and
  // the source-meal active highlight (the row being moved). Slot glyph tints
  // stay warm via `resolveSlotTint`/`SlotColors` (held guardrail).
  const accent = useAccent();

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
      calories: number;
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
          calories: Math.round(m.calories ?? 0),
          isSource: !!from && from.day === dp.day && from.slotIndex === si,
          isEmpty: !!m.isPlaceholder || !m.recipeTitle,
        });
      });
    });
    return out;
  }, [plan, dayLabels, from]);

  // 2026-05-12 (premium-bar audit Plan Card 3 #2): expand the sheet
  // header from a generic "Pick a slot" subtitle into a from-context
  // line that names the meal being moved — `Breakfast · Thu · Tofu
  // poke bowl` style. Reduces the cognitive load of remembering which
  // row was long-pressed two seconds ago.
  const sourceRow = rows.find((r) => r.isSource);

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
            {/* 2026-05-13 (premium-bar audit Plan Card 3 #2): include
                source-meal kcal in the subtitle so the user can spot
                a calorically-relevant swap target without having to
                memorise the source kcal from the previous screen. */}
            <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
              {sourceRow
                ? sourceRow.isEmpty
                  ? `From: ${sourceRow.slotName} · ${sourceRow.dayLabel}`
                  : `From: ${sourceRow.slotName} · ${sourceRow.dayLabel} · ${sourceRow.recipeTitle} · ${sourceRow.calories} kcal`
                : "Pick a slot"}
            </Text>
          </View>
          <Pressable onPress={onClose} accessibilityLabel="Cancel" hitSlop={8}>
            <Text style={{ color: accent.primarySolid, fontWeight: "600" }}>Cancel</Text>
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
              const Glyph = resolveSlotGlyph(r.slotName);
              const tint = resolveSlotTint(r.slotName);
              return (
                <PressableScale
                  key={key}
                  haptic="selection"
                  disabled={r.isSource}
                  onPress={() => onMove({ day: r.day, slotIndex: r.slotIndex })}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityState={{ disabled: r.isSource }}
                  style={[
                    styles.row,
                    {
                      // Sloe treatment system (§7): the source ("FROM") row
                      // reads as a selected pill — aubergine soft-tint fill +
                      // primarySolid border, not a saturated edge.
                      backgroundColor: r.isSource
                        ? accent.primarySoft
                        : colors.background,
                      borderColor: r.isSource ? accent.primarySolid : colors.cardBorder,
                      opacity: r.isSource ? 0.8 : 1,
                    },
                  ]}
                >
                  {/* Leading slot glyph — matches Today meal-rows
                      pattern so the user reads the column structure
                      the same way across surfaces. Premium-bar audit
                      Plan Card 3 #1. */}
                  <View
                    aria-hidden
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      backgroundColor: withAlpha(tint, 0x1A),
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Glyph size={14} color={tint} strokeWidth={2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: r.isSource ? accent.primarySolid : colors.text,
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
                        ...Type.captionSmall,
                        marginTop: Spacing.xs,
                      }}
                      numberOfLines={1}
                    >
                      {r.isEmpty
                        ? "Empty slot"
                        : `${r.recipeTitle}${r.calories > 0 ? ` · ${r.calories} kcal` : ""}`}
                    </Text>
                  </View>
                  {r.isSource ? (
                    <Text
                      style={{
                        color: accent.primarySolid,
                        fontSize: 11,
                        fontWeight: "700",
                        letterSpacing: 0.5,
                      }}
                    >
                      FROM
                    </Text>
                  ) : null}
                </PressableScale>
              );
            })
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Audit 2026-05-04 #33: previously a 35% backdrop + hairline border
  // edge made the sheet look pasted on rather than lifted. Deeper
  // backdrop (50%) plus a soft shadow gives a more premium "sheet
  // raised over content" feel. Hairline border kept for theme-edge
  // contrast on dark mode.
  backdrop: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  title: { fontSize: 18, fontWeight: "700" },
  subtitle: { fontSize: 13, marginTop: Spacing.xs },
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
