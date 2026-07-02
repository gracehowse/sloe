/**
 * Duplicate-day bottom sheet (batch 1.4).
 *
 * Mirrors the web `DuplicateDayDialog`. Single-day mode picks one target
 * from the calendar; Range mode uses the same calendar but adds a second
 * tap (start then end). Shares the same `expandDateRange` /
 * `sanitizeCopyTargets` helpers with the web dialog and the
 * `useNutritionJournalState` hook.
 */
import { useEffect, useMemo, useState } from "react";
import { SHEET_RADIUS } from "@/components/ui/SupprCard";
import { Modal, Pressable, Text, View, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { clampJournalDate, journalRangeBounds } from "@/lib/journalNavigation";
import { dateKeyFromDate } from "@/lib/nutritionJournal";
import { MODAL_OVERLAY_SCRIM } from "@suppr/shared/theme/modalOverlay";
import {
  addDays,
  expandDateRange,
  sanitizeCopyTargets,
} from "@suppr/nutrition-core/copyMeals";

type Theme = {
  text: string;
  textSecondary: string;
  textTertiary: string;
  card: string;
  cardBorder: string;
  background: string;
  primaryForeground: string;
};

type Mode = "single" | "range";

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
  sourceDayKey: string;
  sourceMealCount: number;
  onConfirm: (targetDayKeys: string[], summary: string) => void;
  colors: Theme;
};

export default function DuplicateDaySheet({
  visible,
  onClose,
  sourceDayKey,
  sourceMealCount,
  onConfirm,
  colors,
}: Props) {
  // Secondary accent (Frost flag → damson, else clay) for the active range
  // selection (start/end + in-range tint) and the Duplicate CTA.
  const accent = useAccent();
  const defaultStart = useMemo(() => addDays(sourceDayKey, 1), [sourceDayKey]);
  const defaultEnd = useMemo(() => addDays(sourceDayKey, 7), [sourceDayKey]);
  const [mode, setMode] = useState<Mode>("single");
  const [startKey, setStartKey] = useState(defaultStart);
  const [endKey, setEndKey] = useState(defaultEnd);
  const [viewMonth, setViewMonth] = useState(() => stripMidnight(new Date()));
  const { min, max } = useMemo(() => journalRangeBounds(), []);

  useEffect(() => {
    if (visible) {
      setMode("single");
      setStartKey(defaultStart);
      setEndKey(defaultEnd);
      const [y, m, d] = defaultStart.split("-").map(Number);
      setViewMonth(new Date(y, (m ?? 1) - 1, d ?? 1));
    }
  }, [visible, defaultStart, defaultEnd]);

  const matrix = useMemo(() => monthMatrix(viewMonth), [viewMonth]);

  const targetDayKeys = useMemo(() => {
    const raw = mode === "single" ? [startKey] : expandDateRange(startKey, endKey);
    return sanitizeCopyTargets(sourceDayKey, raw);
  }, [mode, startKey, endKey, sourceDayKey]);

  const canConfirm = sourceMealCount > 0 && targetDayKeys.length > 0;

  const summary = useMemo(() => {
    if (sourceMealCount === 0) return "Nothing to duplicate";
    if (targetDayKeys.length === 0) return "Nothing to duplicate";
    if (targetDayKeys.length === 1) return `Duplicated to ${formatHumanDate(targetDayKeys[0]!)}`;
    return `Duplicated to ${targetDayKeys.length} days`;
  }, [targetDayKeys, sourceMealCount]);

  const onCellPress = (ck: string) => {
    if (mode === "single") {
      setStartKey(ck);
      return;
    }
    // Range mode: two-tap interaction — first tap sets start, second sets end.
    if (ck < startKey) {
      setStartKey(ck);
    } else {
      setEndKey(ck);
    }
  };

  const isInRange = (ck: string): boolean => {
    if (mode !== "range") return false;
    return ck >= startKey && ck <= endKey;
  };

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
            Duplicate day
          </Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: Spacing.md }}>
            {sourceMealCount === 0
              ? "This day has no meals to duplicate."
              : `${sourceMealCount} meal${sourceMealCount === 1 ? "" : "s"} from ${formatHumanDate(sourceDayKey)}`}
          </Text>

          {/* Mode toggle */}
          <View
            style={{
              flexDirection: "row",
              borderRadius: Radius.md,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              overflow: "hidden",
              marginBottom: Spacing.md,
            }}
            accessibilityRole="tablist"
          >
            {(["single", "range"] as Mode[]).map((m) => {
              const isActive = mode === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => setMode(m)}
                  accessibilityRole="tab"
                  accessibilityLabel={m === "single" ? "Single day" : "Date range"}
                  accessibilityState={{ selected: isActive }}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    alignItems: "center",
                    backgroundColor: isActive ? accent.primary : "transparent",
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: "700", color: isActive ? colors.primaryForeground : colors.textSecondary }}>
                    {m === "single" ? "Single day" : "Date range"}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
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
                const disabled =
                  cell.getTime() < min.getTime() ||
                  cell.getTime() > max.getTime() ||
                  ck === sourceDayKey;
                const isStart = ck === startKey;
                const isEnd = ck === endKey;
                const inRange = isInRange(ck);
                const isHighlighted = mode === "single" ? isStart : isStart || isEnd;
                return (
                  <Pressable
                    key={`${ck}-${idx}`}
                    disabled={disabled}
                    onPress={() => onCellPress(ck)}
                    accessibilityRole="button"
                    accessibilityLabel={`Pick ${formatHumanDate(ck)}`}
                    accessibilityState={{ selected: isHighlighted, disabled }}
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
                        backgroundColor: isHighlighted
                          ? accent.primary
                          : inRange
                            ? accent.primary + "22"
                            : "transparent",
                        opacity: disabled ? 0.28 : 1,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: isHighlighted ? "800" : "600",
                          color: isHighlighted ? colors.primaryForeground : colors.text,
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
            {mode === "range" && (
              <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: Spacing.sm }}>
                {`Range: ${formatHumanDate(startKey)} – ${formatHumanDate(endKey)}`}
              </Text>
            )}
          </ScrollView>

          <Text style={{ ...Type.captionSmall, color: colors.textTertiary, marginTop: Spacing.md }}>
            {sourceMealCount === 0
              ? "Nothing to duplicate — this day has no meals."
              : targetDayKeys.length === 0
                ? "Nothing to duplicate — pick a day other than the source."
                : targetDayKeys.length === 1
                  ? `Will duplicate ${sourceMealCount} meal${sourceMealCount === 1 ? "" : "s"} to ${formatHumanDate(targetDayKeys[0]!)}.`
                  : `Will duplicate ${sourceMealCount} meal${sourceMealCount === 1 ? "" : "s"} to ${targetDayKeys.length} days.`}
          </Text>

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
                  onConfirm([], summary);
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
              accessibilityLabel="Duplicate"
              accessibilityState={{ disabled: !canConfirm }}
            >
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.primaryForeground }}>Duplicate</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
