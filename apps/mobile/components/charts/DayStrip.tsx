import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, LayoutChangeEvent, Pressable, Text, View } from "react-native";
import { Calendar, ChevronLeft, ChevronRight, Snowflake } from "lucide-react-native";

import { Accent, IconSize, Radius, Spacing, Type } from "@/constants/theme";
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
  // ENG-1008 (2026-06-10): only user-initiated swipes may write `selectedDate`
  // back from scroll position. Programmatic `scrollToOffset` calls (the align
  // effect below) can be CLAMPED by RN to the last measured page when the
  // target week hasn't been laid out yet; the momentum-end readback of that
  // clamped settle overwrote a correct calendar/deep-link date with the last
  // week of the journal range (+5 weeks, weekday preserved — the "June 3 →
  // July 8" bug). User gestures always begin with a drag; programmatic
  // scrolls never do, so `onScrollBeginDrag` is the discriminator.
  const userDragRef = useRef(false);
  const [pagerW, setPagerW] = useState(0);
  const { min, max } = useMemo(() => journalRangeBounds(), []);
  const weekStarts = useMemo(() => enumerateWeekStartsInJournalRange(weekStartDay), [weekStartDay]);
  const selectedDk = dateKeyFromDate(selectedDate);
  const todayDk = dateKeyFromDate(new Date());
  // The week the pager is currently SHOWING (v3 prototype `.day-nav` chevrons,
  // ENG-1247). Distinct from the selected day's week so the chevrons can browse
  // future weeks (whose days are out-of-range/disabled) without moving the
  // selection — repeated chevron taps step from here, not from `selectedDate`.
  const [viewWeekIdx, setViewWeekIdx] = useState(() =>
    weekIndexContaining(selectedDate, weekStarts),
  );

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
    setViewWeekIdx(idx);
  }, [selectedDate, weekStarts, pagerW, scrollToWeekIndex]);

  /** Step the VIEWED week via the prototype `.day-nav` chevrons (ENG-1247).
   *  Scrolls the pager only — selection is unchanged until the user taps a day
   *  (matching the prototype, which lets you browse past/future weeks). */
  const goViewWeek = useCallback(
    (delta: number) => {
      const next = Math.max(0, Math.min(weekStarts.length - 1, viewWeekIdx + delta));
      if (next === viewWeekIdx) return;
      setViewWeekIdx(next);
      scrollToWeekIndex(next, true);
    },
    [viewWeekIdx, weekStarts.length, scrollToWeekIndex],
  );

  const onPagerLayout = useCallback((e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && w !== pagerW) setPagerW(w);
  }, [pagerW]);

  const handleMomentumEnd = useCallback(
    (e: { nativeEvent: { contentOffset: { x: number } } }) => {
      // Ignore momentum from programmatic scrolls (see userDragRef above).
      if (!userDragRef.current) return;
      userDragRef.current = false;
      if (pagerW <= 0) return;
      const idx = Math.round(e.nativeEvent.contentOffset.x / pagerW);
      const clamped = Math.max(0, Math.min(weekStarts.length - 1, idx));
      setViewWeekIdx(clamped);
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
          // v3 prototype `.day-cell` treatment (ENG-1247, 2026-06-24): the
          // SELECTED day fills the whole cell with plum + white letter/date/dot
          // (the prototype's `.is-sel` — supersedes the 2026-06-10 soft-tint
          // pill); today-not-selected = accent number; logged = sage dot. The
          // state→treatment rule lives in the pure `dayStripIndicator` helper so
          // the component and its unit test share one source of truth.
          const { dotKind, dotColor, numberColor, isActive, selectedFill, cellBg } = dayStripIndicatorStyle(
            { isSelected, isToday, hasLogs },
            { accent: accent.primary, sage: Accent.success, text: textColor, onAccent: accent.primaryForeground },
          );
          const labelColor = selectedFill ? accent.primaryForeground : secondaryColor;
          return (
            <Pressable
              key={`${dateKeyFromDate(weekStart)}-${dk}`}
              onPress={() => onSelectDate(clampJournalDate(date))}
              accessibilityLabel={isProtected ? `Freeze used on ${dk}` : undefined}
              style={{
                flex: 1,
                alignItems: "center",
                gap: Spacing.xs,
                paddingVertical: 8,
                marginHorizontal: 1,
                // v3 `.is-sel`: the WHOLE cell fills plum (Radius.xl=12, the
                // on-scale neighbour of the prototype's 14px).
                borderRadius: Radius.xl,
                backgroundColor: cellBg,
                opacity: outOfRange ? 0.35 : 1,
              }}
            >
              <Text
                // headers census 2026-06-10: day-axis label → Type.label (11px;
                // census kept the canonical step over a private 10px density size).
                style={{ ...Type.label, color: labelColor }}
              >
                {label}
              </Text>
              <View
                style={{
                  position: "relative",
                  minWidth: 28,
                  height: 28,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    ...Type.headline,
                    fontSize: 16,
                    lineHeight: 20,
                    fontWeight: isActive || selectedFill ? "700" : "600",
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

  // v3 prototype `.day-strip` (ENG-1247): ‹ › week chevrons flank the pager;
  // the far-date calendar icon stays (the prototype delegates that to its top
  // bar, which the app doesn't have). The old "Jump to today" pill is dropped —
  // the chevrons + calendar cover navigation and the prototype has no such pill.
  const prevDisabled = viewWeekIdx <= 0;
  const nextDisabled = viewWeekIdx >= weekStarts.length - 1;
  return (
    <View style={{ gap: Spacing.xs }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
        <Pressable
          onPress={() => goViewWeek(-1)}
          disabled={prevDisabled}
          accessibilityRole="button"
          accessibilityLabel="Previous week"
          hitSlop={8}
          style={{ padding: 6, opacity: prevDisabled ? 0.3 : 1 }}
        >
          <ChevronLeft size={IconSize.lg} color={secondaryColor} strokeWidth={2} />
        </Pressable>
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
              // Mount directly on the selected week so the align effect's
              // corrective scroll is a no-op — removes the only scroll that
              // could target unmeasured content (ENG-1008 hardening; safe
              // because `getItemLayout` is provided).
              initialScrollIndex={weekIndexContaining(selectedDate, weekStarts)}
              renderItem={renderWeekPage}
              onScrollBeginDrag={() => {
                userDragRef.current = true;
              }}
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
          onPress={() => goViewWeek(1)}
          disabled={nextDisabled}
          accessibilityRole="button"
          accessibilityLabel="Next week"
          hitSlop={8}
          style={{ padding: 6, opacity: nextDisabled ? 0.3 : 1 }}
        >
          <ChevronRight size={IconSize.lg} color={secondaryColor} strokeWidth={2} />
        </Pressable>
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
