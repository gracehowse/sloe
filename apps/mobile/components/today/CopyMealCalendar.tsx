/**
 * Month calendar grid for `CopyMealSheet` (extracted 2026-07-21, ENG-786 —
 * screen-budget shrink: `CopyMealSheet.tsx` crossed the 400-line
 * `check:screen-budget` ratchet after the ENG-786 rebuild's slot selector
 * landed; this is a pure extraction, no behaviour change from the inline
 * version it replaces).
 *
 * Renders the month header (prev/next chevrons + month/year label), the
 * S/M/T/W/T/F/S weekday row, and the 6x7 day-cell grid. Selection/disabled
 * logic (the `sanitizeCopySlotTargets`-mirroring same-day/same-slot no-op
 * check, min/max journal range bounds) stays owned by the caller and is
 * passed in via props — this component is rendering + a pick callback.
 */
import { useMemo } from "react";
import { PressableScale } from "@/components/ui/PressableScale";
import { Text, View } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";

import { Radius, Spacing } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { clampJournalDate } from "@/lib/journalNavigation";
import { dateKeyFromDate } from "@/lib/nutritionJournal";

function formatHumanDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0);
  return dt.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
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
  viewMonth: Date;
  onChangeMonth: (next: Date) => void;
  /** `YYYY-MM-DD` — the currently-selected target day. */
  targetKey: string;
  onPick: (dateKey: string) => void;
  /** `YYYY-MM-DD` — the day the meal currently lives on. */
  sourceDayKey: string;
  sourceSlot: string;
  targetSlot: string;
  min: Date;
  max: Date;
  colors: { text: string; textTertiary: string; primaryForeground: string };
};

export default function CopyMealCalendar({
  viewMonth,
  onChangeMonth,
  targetKey,
  onPick,
  sourceDayKey,
  sourceSlot,
  targetSlot,
  min,
  max,
  colors,
}: Props) {
  const accent = useAccent();
  const matrix = useMemo(() => monthMatrix(viewMonth), [viewMonth]);
  const monthLabel = viewMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <>
      {/* Month header */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.xs }}>
        <PressableScale
          onPress={() => onChangeMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
          haptic="selection"
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
        >
          <ChevronLeft size={20} color={colors.text} />
        </PressableScale>
        <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>{monthLabel}</Text>
        <PressableScale
          onPress={() => onChangeMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
          haptic="selection"
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Next month"
        >
          <ChevronRight size={20} color={colors.text} />
        </PressableScale>
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
          // ENG-786 rebuild — the source day is only a true no-op
          // target when the slot is ALSO unchanged (mirrors
          // `sanitizeCopySlotTargets`); switching the slot makes the
          // source day a legal target (e.g. "Lunch" → "today, Dinner").
          const disabled =
            cell.getTime() < min.getTime() ||
            cell.getTime() > max.getTime() ||
            (ck === sourceDayKey && targetSlot === sourceSlot);
          const isSel = ck === targetKey;
          return (
            <PressableScale
              key={`${ck}-${idx}`}
              disabled={disabled}
              onPress={() => onPick(dateKeyFromDate(clampJournalDate(cell)))}
              haptic="selection"
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
            </PressableScale>
          );
        })}
      </View>
    </>
  );
}
