import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, LayoutChangeEvent, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Accent, Spacing } from "@/constants/theme";
import {
  addDaysLocal,
  clampJournalDate,
  dayIndexInWeek,
  enumerateWeekStartsInJournalRange,
  journalRangeBounds,
} from "@/lib/journalNavigation";
import { dateKeyFromDate } from "@/lib/nutritionJournal";

type Props = {
  selectedDate: Date;
  weekStartDay: "monday" | "sunday";
  loggedDays: Set<string>;
  onSelectDate: (date: Date) => void;
  onOpenCalendar: () => void;
  textColor: string;
  secondaryColor: string;
};

function weekIndexContaining(d: Date, weekStarts: Date[]): number {
  const dk = dateKeyFromDate(d);
  for (let i = 0; i < weekStarts.length; i++) {
    const ws = weekStarts[i]!;
    const end = addDaysLocal(ws, 6);
    if (dk >= dateKeyFromDate(ws) && dk <= dateKeyFromDate(end)) return i;
  }
  return 0;
}

export default function DayStrip({
  selectedDate,
  weekStartDay,
  loggedDays,
  onSelectDate,
  onOpenCalendar,
  textColor,
  secondaryColor,
}: Props) {
  const flatRef = useRef<FlatList<Date>>(null);
  const [pagerW, setPagerW] = useState(0);
  const { min, max } = useMemo(() => journalRangeBounds(), []);
  const weekStarts = useMemo(() => enumerateWeekStartsInJournalRange(weekStartDay), [weekStartDay]);
  const selectedDk = dateKeyFromDate(selectedDate);
  const todayDk = dateKeyFromDate(new Date());

  const dowLabels = useMemo(
    () =>
      weekStartDay === "monday"
        ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    [weekStartDay],
  );

  const scrollToWeekIndex = useCallback(
    (index: number, animated: boolean) => {
      if (pagerW <= 0 || !flatRef.current || weekStarts.length === 0) return;
      const clamped = Math.max(0, Math.min(weekStarts.length - 1, index));
      flatRef.current.scrollToOffset({ offset: clamped * pagerW, animated });
    },
    [pagerW, weekStarts.length],
  );

  /** Keep pager aligned when `selectedDate` jumps (Today, calendar, route params). */
  useEffect(() => {
    if (pagerW <= 0) return;
    const idx = weekIndexContaining(selectedDate, weekStarts);
    scrollToWeekIndex(idx, false);
  }, [selectedDate, weekStarts, pagerW, scrollToWeekIndex]);

  const onPagerLayout = useCallback((e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && w !== pagerW) setPagerW(w);
  }, [pagerW]);

  const handleToday = useCallback(() => {
    onSelectDate(clampJournalDate(new Date()));
  }, [onSelectDate]);

  const handleMomentumEnd = useCallback(
    (e: { nativeEvent: { contentOffset: { x: number } } }) => {
      if (pagerW <= 0) return;
      const idx = Math.round(e.nativeEvent.contentOffset.x / pagerW);
      const clamped = Math.max(0, Math.min(weekStarts.length - 1, idx));
      const newWeekStart = weekStarts[clamped];
      if (!newWeekStart) return;
      const col = dayIndexInWeek(selectedDate, weekStartDay);
      const next = clampJournalDate(addDaysLocal(newWeekStart, col));
      if (dateKeyFromDate(next) !== selectedDk) onSelectDate(next);
    },
    [pagerW, weekStarts, selectedDate, weekStartDay, selectedDk, onSelectDate],
  );

  const renderWeekPage = useCallback(
    ({ item: weekStart }: { item: Date }) => (
      <View style={{ width: pagerW, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 2 }}>
        {dowLabels.map((label, i) => {
          const date = addDaysLocal(weekStart, i);
          const dk = dateKeyFromDate(date);
          const isSelected = dk === selectedDk;
          const isToday = dk === todayDk;
          const hasLogs = loggedDays.has(dk);
          const outOfRange = date.getTime() < min.getTime() || date.getTime() > max.getTime();
          return (
            <Pressable
              key={`${dateKeyFromDate(weekStart)}-${dk}`}
              onPress={() => onSelectDate(clampJournalDate(date))}
              style={{ flex: 1, alignItems: "center", gap: 4, paddingVertical: 4, opacity: outOfRange ? 0.35 : 1 }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "600",
                  color: isSelected ? Accent.primary : secondaryColor,
                  letterSpacing: 0.2,
                }}
              >
                {label}
              </Text>
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isSelected ? Accent.primary : hasLogs ? Accent.success + "22" : "transparent",
                  borderWidth: isToday && !isSelected ? 2 : 0,
                  borderColor: Accent.primary + "55",
                }}
              >
                {hasLogs && !isSelected ? (
                  <Ionicons name="checkmark" size={15} color={Accent.success} />
                ) : (
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: isSelected || isToday ? "800" : "600",
                      color: isSelected ? "#fff" : textColor,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {date.getDate()}
                  </Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    ),
    [pagerW, dowLabels, selectedDk, todayDk, loggedDays, min, max, textColor, secondaryColor, onSelectDate],
  );

  return (
    <View style={{ gap: Spacing.xs }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
        <Pressable
          onPress={handleToday}
          accessibilityRole="button"
          accessibilityLabel="Jump to today"
          hitSlop={8}
          style={{ paddingVertical: 8, paddingHorizontal: 4 }}
        >
          <Text style={{ fontSize: 14, fontWeight: "700", color: Accent.primary }}>Today</Text>
        </Pressable>
        <View style={{ flex: 1 }} onLayout={onPagerLayout}>
          {pagerW > 0 ? (
            <FlatList<Date>
              ref={flatRef}
              style={{ width: pagerW }}
              data={weekStarts}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(ws) => `w-${dateKeyFromDate(ws)}`}
              getItemLayout={(_, index) => ({
                length: pagerW,
                offset: pagerW * index,
                index,
              })}
              renderItem={renderWeekPage}
              onMomentumScrollEnd={handleMomentumEnd}
              keyboardShouldPersistTaps="handled"
              removeClippedSubviews={false}
              windowSize={7}
              maxToRenderPerBatch={6}
              initialNumToRender={5}
              extraData={selectedDk}
            />
          ) : (
            <View style={{ height: 56 }} />
          )}
        </View>
        <Pressable
          onPress={onOpenCalendar}
          accessibilityRole="button"
          accessibilityLabel="Open calendar"
          hitSlop={10}
          style={{ padding: 8 }}
        >
          <Ionicons name="calendar-outline" size={22} color={Accent.primary} />
        </Pressable>
      </View>
    </View>
  );
}
