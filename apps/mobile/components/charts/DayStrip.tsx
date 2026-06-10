import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, LayoutChangeEvent, Pressable, Text, View } from "react-native";
import { Calendar, Snowflake } from "lucide-react-native";

import { Accent, IconSize, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import {
  addDaysLocal,
  clampJournalDate,
  dayIndexInWeek,
  enumerateWeekStartsInJournalRange,
  journalRangeBounds,
} from "@/lib/journalNavigation";
import { dateKeyFromDate } from "@/lib/nutritionJournal";
import { dayStripIndicatorStyle } from "@suppr/shared/today/dayStripIndicator";
import { weekdayInitials } from "@suppr/shared/today/weekdayLabels";

type Props = {
  selectedDate: Date;
  weekStartDay: "monday" | "sunday";
  loggedDays: Set<string>;
  /**
   * Date keys where a streak freeze was consumed (2026-04-18 audit H7).
   * Tiles matching these keys render a small snowflake glyph in the
   * corner and carry "Freeze used on {dateKey}" as their accessibility
   * label so VoiceOver / TalkBack announce the save. Parity with web
   * `DayStrip` prop of the same name. Derived from
   * `computeProtectedStreak(...).protectedDateKeys` by the parent.
   */
  protectedDateKeys?: ReadonlySet<string>;
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
  protectedDateKeys,
  onSelectDate,
  onOpenCalendar,
  textColor,
  secondaryColor,
}: Props) {
  // Secondary accent (Frost flag → damson, else clay) for the selected/today
  // day pip + the "Today" jump label + calendar glyph. The "sage" logged-day
  // marker stays `Accent.success` (held).
  const accent = useAccent();
  const flatRef = useRef<FlatList<Date>>(null);
  const [pagerW, setPagerW] = useState(0);
  const { min, max } = useMemo(() => journalRangeBounds(), []);
  const weekStarts = useMemo(() => enumerateWeekStartsInJournalRange(weekStartDay), [weekStartDay]);
  const selectedDk = dateKeyFromDate(selectedDate);
  const todayDk = dateKeyFromDate(new Date());

  // Sloe redesign (2026-06-08) — single-letter weekday labels to match the
  // canonical Figma `654:2` Today frame (`S M T W T F S`), replacing the
  // 2026-05-14 three-letter `Mon/Tue/Wed` treatment. The day NUMBER below the
  // letter disambiguates the date. Shared with web `DayStrip` via
  // `weekdayInitials` so the two surfaces can't drift.
  const dowLabels = useMemo(
    () => weekdayInitials(weekStartDay),
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
          const isProtected = protectedDateKeys?.has(dk) ?? false;
          const outOfRange = date.getTime() < min.getTime() || date.getTime() > max.getTime();
          // SLOE redesign — minimal current-day treatment (2026-06-03,
          // Grace's feedback: the filled clay pill read as clunky). The design
          // rule (clay number + clay dot for the active day, sage dot for
          // logged days, NO filled background, clay precedence on the both-
          // case) lives in the pure `dayStripIndicator` helper so the
          // component and its unit test share one source of truth.
          const { dotKind, dotColor, numberColor, isActive } = dayStripIndicatorStyle(
            { isSelected, isToday, hasLogs },
            { clay: accent.primary, sage: Accent.success, text: textColor },
          );
          return (
            <Pressable
              key={`${dateKeyFromDate(weekStart)}-${dk}`}
              onPress={() => onSelectDate(clampJournalDate(date))}
              accessibilityLabel={isProtected ? `Freeze used on ${dk}` : undefined}
              style={{
                flex: 1,
                alignItems: "center",
                gap: 5,
                paddingVertical: 8,
                marginHorizontal: 1,
                opacity: outOfRange ? 0.35 : 1,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "600",
                  textTransform: "uppercase",
                  color: secondaryColor,
                  letterSpacing: 0.4,
                }}
              >
                {label}
              </Text>
              <View style={{ position: "relative" }}>
                <Text
                  style={{
                    ...Type.headline,
                    fontSize: 16,
                    lineHeight: 20,
                    fontWeight: isActive ? "700" : "600",
                    color: numberColor,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {date.getDate()}
                </Text>
                {isProtected ? (
                  <View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      top: -6,
                      right: -10,
                      width: 14,
                      height: 14,
                      borderRadius: 7,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: Accent.cyan + "33",
                    }}
                  >
                    <Snowflake size={IconSize.xs} color={Accent.cyan} strokeWidth={2} />
                  </View>
                ) : null}
              </View>
              <View
                testID={`daystrip-dot-minimal-${dotKind}`}
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: dotColor,
                }}
              />
            </Pressable>
          );
        })}
      </View>
    ),
    [pagerW, dowLabels, selectedDk, todayDk, loggedDays, protectedDateKeys, min, max, textColor, secondaryColor, onSelectDate, accent],
  );

  // 2026-05-12 (premium-bar audit, Today header upgrade): only render
  // the "Jump to today" pill when the selected date is NOT today. On
  // the default load the pill duplicated the h1 "Today" — visually
  // redundant and the user is already where they'd jump to.
  const showJumpToToday = selectedDk !== todayDk;
  return (
    <View style={{ gap: Spacing.xs }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
        {showJumpToToday ? (
          <Pressable
            onPress={handleToday}
            accessibilityRole="button"
            accessibilityLabel="Jump to today"
            hitSlop={8}
            style={{ paddingVertical: 8, paddingHorizontal: 4 }}
          >
            <Text style={{ fontSize: 14, fontWeight: "700", color: accent.primary }}>Today</Text>
          </Pressable>
        ) : null}
        <View testID="daystrip-pager" style={{ flex: 1 }} onLayout={onPagerLayout}>
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
          <Calendar size={IconSize.lg} color={accent.primary} strokeWidth={1.75} />
        </Pressable>
      </View>
    </View>
  );
}
