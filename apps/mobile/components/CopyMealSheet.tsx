/**
 * Copy-meal bottom sheet (batch 1.4).
 *
 * Mirrors the web `CopyMealDialog` — date picker + "also copy to next N
 * days" quick chips. Shares the same `sanitizeCopyTargets` / `addDays`
 * helpers from `src/lib/nutrition/copyMeals.ts` so the two platforms
 * cannot drift on target-list dedup or date arithmetic.
 */
import { useEffect, useMemo, useState } from "react";
import { SHEET_RADIUS } from "@/components/ui/SupprCard";
import { Modal, Pressable, Text, View, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Radius, Spacing } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { clampJournalDate, journalRangeBounds } from "@/lib/journalNavigation";
import { dateKeyFromDate } from "@/lib/nutritionJournal";
import { MODAL_OVERLAY_SCRIM } from "@suppr/shared/theme/modalOverlay";
import {
  addDays,
  sanitizeCopyTargets,
} from "@suppr/shared/nutrition/copyMeals";

type Theme = {
  text: string;
  textSecondary: string;
  textTertiary: string;
  card: string;
  cardBorder: string;
  background: string;
  primaryForeground: string;
};

type QuickRange = "none" | "+2" | "+3" | "+7";

const QUICK_RANGES: { key: QuickRange; label: string; days: number }[] = [
  { key: "+2", label: "Next 2 days", days: 2 },
  { key: "+3", label: "Next 3 days", days: 3 },
  { key: "+7", label: "Next 7 days", days: 7 },
];

function formatHumanDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0);
  return dt.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function stripMidnight(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function monthMatrix(viewMonth: Date): (Date | null)[] {
  const y = viewMonth.getFullYear();
  const m = viewMonth.getMonth();
  const first = new Date(y, m, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, m, d));
  while (cells.length % 7 !== 0) cells.push(null);
  while (cells.length < 42) cells.push(null);
  return cells;
}

type Props = {
  visible: boolean;
  onClose: () => void;
  /** `YYYY-MM-DD` — the day the meal currently lives on. */
  sourceDayKey: string;
  /** Shown in the header. */
  mealLabel: string;
  /** Called with the deduped, source-excluded target keys + human summary. */
  onConfirm: (targetDayKeys: string[], summary: string) => void;
  colors: Theme;
};

export default function CopyMealSheet({
  visible,
  onClose,
  sourceDayKey,
  mealLabel,
  onConfirm,
  colors,
}: Props) {
  // Secondary accent (Frost flag → damson, else clay) for the selected calendar
  // day, active quick-range chips, and the Copy CTA.
  const accent = useAccent();
  const defaultTarget = useMemo(() => addDays(sourceDayKey, 1), [sourceDayKey]);
  const [targetKey, setTargetKey] = useState(defaultTarget);
  const [quickRange, setQuickRange] = useState<QuickRange>("none");
  const [viewMonth, setViewMonth] = useState(() => stripMidnight(new Date()));
  const { min, max } = useMemo(() => journalRangeBounds(), []);

  useEffect(() => {
    if (visible) {
      setTargetKey(defaultTarget);
      setQuickRange("none");
      const [y, m, d] = defaultTarget.split("-").map(Number);
      setViewMonth(new Date(y, (m ?? 1) - 1, d ?? 1));
    }
  }, [visible, defaultTarget]);

  const matrix = useMemo(() => monthMatrix(viewMonth), [viewMonth]);

  const targetDayKeys = useMemo(() => {
    const base = [targetKey];
    if (quickRange !== "none") {
      const range = QUICK_RANGES.find((r) => r.key === quickRange);
      if (range) {
        for (let i = 1; i < range.days; i += 1) base.push(addDays(targetKey, i));
      }
    }
    return sanitizeCopyTargets(sourceDayKey, base);
  }, [targetKey, quickRange, sourceDayKey]);

  const summary = useMemo(() => {
    if (targetDayKeys.length === 0) return "Nothing to copy";
    if (targetDayKeys.length === 1) return `Copied to ${formatHumanDate(targetDayKeys[0]!)}`;
    return `Copied to ${targetDayKeys.length} days`;
  }, [targetDayKeys]);

  const canConfirm = targetDayKeys.length > 0;

  const monthLabel = viewMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: MODAL_OVERLAY_SCRIM, justifyContent: "flex-end" }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: SHEET_RADIUS,
            borderTopRightRadius: SHEET_RADIUS,
            padding: Spacing.lg,
            paddingBottom: Spacing.xl,
          }}
        >
          <View style={{ alignItems: "center", marginBottom: Spacing.sm }}>
            <View style={{ width: 36, height: 4, borderRadius: Radius.full, backgroundColor: colors.cardBorder }} />
          </View>
          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 4 }}>
            Copy meal to another day
          </Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: Spacing.md }}>
            {`"${mealLabel}"`}
          </Text>

          <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
            {/* Month header */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <Pressable
                onPress={() => setViewMonth((v) => new Date(v.getFullYear(), v.getMonth() - 1, 1))}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Previous month"
              >
                <Ionicons name="chevron-back" size={20} color={colors.text} />
              </Pressable>
              <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>{monthLabel}</Text>
              <Pressable
                onPress={() => setViewMonth((v) => new Date(v.getFullYear(), v.getMonth() + 1, 1))}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Next month"
              >
                <Ionicons name="chevron-forward" size={20} color={colors.text} />
              </Pressable>
            </View>
            <View style={{ flexDirection: "row", marginBottom: 4 }}>
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <Text
                  key={`${d}-${i}`}
                  style={{ flex: 1, textAlign: "center", fontSize: 11, fontWeight: "600", color: colors.textTertiary }}
                >
                  {d}
                </Text>
              ))}
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {matrix.map((cell, idx) => {
                if (!cell) {
                  return <View key={`pad-${idx}`} style={{ width: `${100 / 7}%`, aspectRatio: 1, maxWidth: 48 }} />;
                }
                const ck = dateKeyFromDate(cell);
                const disabled = cell.getTime() < min.getTime() || cell.getTime() > max.getTime() || ck === sourceDayKey;
                const isSel = ck === targetKey;
                return (
                  <Pressable
                    key={`${ck}-${idx}`}
                    disabled={disabled}
                    onPress={() => setTargetKey(dateKeyFromDate(clampJournalDate(cell)))}
                    accessibilityRole="button"
                    accessibilityLabel={`Pick ${formatHumanDate(ck)}`}
                    accessibilityState={{ selected: isSel, disabled }}
                    style={{
                      width: `${100 / 7}%`,
                      aspectRatio: 1,
                      maxWidth: 48,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: Radius.full,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: isSel ? accent.primary : "transparent",
                        opacity: disabled ? 0.28 : 1,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: isSel ? "800" : "600",
                          color: isSel ? colors.primaryForeground : colors.text,
                          fontVariant: ["tabular-nums"],
                        }}
                      >
                        {cell.getDate()}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {/* Quick range chips */}
          <Text style={{ fontSize: 12, fontWeight: "600", color: colors.textSecondary, marginTop: Spacing.md, marginBottom: 6 }}>
            Also copy to
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {(["none", ...QUICK_RANGES.map((r) => r.key)] as QuickRange[]).map((key) => {
              const isActive = quickRange === key;
              const label = key === "none" ? "Just this day" : QUICK_RANGES.find((r) => r.key === key)!.label;
              return (
                <Pressable
                  key={key}
                  onPress={() => setQuickRange(key)}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityState={{ selected: isActive }}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: Radius.full,
                    borderWidth: 1,
                    borderColor: isActive ? accent.primary : colors.cardBorder,
                    backgroundColor: isActive ? accent.primary : "transparent",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "600",
                      color: isActive ? colors.primaryForeground : colors.text,
                    }}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Factual summary */}
          <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: Spacing.md }}>
            {targetDayKeys.length === 0
              ? "Nothing to copy — pick a day other than the source."
              : targetDayKeys.length === 1
                ? `Will copy to ${formatHumanDate(targetDayKeys[0]!)}.`
                : `Will copy to ${targetDayKeys.length} days (${formatHumanDate(targetDayKeys[0]!)} – ${formatHumanDate(
                    targetDayKeys[targetDayKeys.length - 1]!,
                  )}).`}
          </Text>

          {/* Action row */}
          <View style={{ flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.lg }}>
            <Pressable
              onPress={onClose}
              style={{
                flex: 1,
                paddingVertical: 12,
                alignItems: "center",
                borderWidth: 1,
                borderColor: colors.cardBorder,
                borderRadius: Radius.md,
              }}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (!canConfirm) {
                  onConfirm([], "Nothing to copy");
                  onClose();
                  return;
                }
                onConfirm(targetDayKeys, summary);
                onClose();
              }}
              disabled={!canConfirm}
              style={{
                flex: 1,
                paddingVertical: 12,
                alignItems: "center",
                borderRadius: Radius.md,
                backgroundColor: canConfirm ? accent.primary : colors.cardBorder,
              }}
              accessibilityRole="button"
              accessibilityLabel="Copy"
              accessibilityState={{ disabled: !canConfirm }}
            >
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.primaryForeground }}>Copy</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
