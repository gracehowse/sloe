import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, LayoutChangeEvent, Text, type TextStyle, View } from "react-native";
import { Calendar, ChevronLeft, ChevronRight, Snowflake } from "lucide-react-native";

import { Accent, IconSize, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
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
import { isFeatureEnabled } from "@/lib/analytics";
import { PressableScale } from "@/components/ui/PressableScale";

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
  /** Muted tertiary tone (2026-07-24) — the day-letter label + the future-day
   *  "not yet" number tint. Falls back to the theme's own `textTertiary` when
   *  the host doesn't pass it (e.g. the week-mode strip in `TodayScreen`), so
   *  the future tint is never silently downgraded to the secondary tone. */
  tertiaryColor?: string;
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
  tertiaryColor,
}: Props) {
  // Secondary accent (Frost flag → damson, else clay) for the selected/today
  // day pip + the "Today" jump label + calendar glyph. The "sage" logged-day
  // marker stays `Accent.success` (held).
  const accent = useAccent();
  const colors = useThemeColors();
  // design_consistency_v1 — ring selection + single-meaning dot + future tint.
  // Flag OFF restores the 2026-06-24 v3 filled-cell treatment VERBATIM (see the
  // shared decision module), so the flag is a true kill switch rather than a
  // hybrid with no selection affordance. Every visual delta below is gated.
  const unifiedChrome = isFeatureEnabled("design_consistency_v1");
  const tertiaryInk = tertiaryColor ?? colors.textTertiary;
  // Type comes from the ramp on both paths. Under the flag the day letter takes
  // `Type.statLabel` and the numeral `Type.navTitle` — byte-identical to the
  // sibling week strip (`PlanWeekStripV3`), which is the point of the pass.
  const letterStyle: TextStyle = unifiedChrome ? Type.statLabel : Type.label;
  // Memoised: the legacy branch builds a fresh object, which would otherwise
  // change `renderWeekPage`'s identity every render and re-render every tile.
  const numberStyle: TextStyle = useMemo(
    () => (unifiedChrome ? Type.navTitle : { ...Type.headline, fontSize: 16, lineHeight: 20 }),
    [unifiedChrome],
  );
  const chevronColor = unifiedChrome ? tertiaryInk : secondaryColor;
  const chevronStroke = unifiedChrome ? 1.75 : 2;
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
          const isFuture = dk > todayDk;
          // Every visual channel resolves in the shared `dayStripIndicatorStyle`
          // so this component and web `DayStrip` cannot drift, and the unit test
          // pins the same decision that renders. Under design_consistency_v1:
          // RING = selection, NUMBER tone = temporal state, DOT = has-data.
          const {
            dotKind, numberColor, dotColor, selectedRing, selectedFill,
            numberTone, cellBg, dimFutureCell,
          } = dayStripIndicatorStyle(
            { isSelected, isToday, hasLogs, isFuture, unifiedChrome },
            {
              accent: accent.primary,
              sage: Accent.success,
              text: textColor,
              secondary: secondaryColor,
              // "Not yet", not "unavailable" — a future day steps its number
              // to the tertiary ink tint instead of fading the whole cell.
              tertiary: tertiaryInk,
              // Empty dot = the FAINT border hairline tone, never
              // `textTertiary` (a mid-grey that read as a hard dot on all
              // seven days). The pre-flag strip had no empty slot at all.
              emptyDot: unifiedChrome ? colors.border : "transparent",
              onAccent: accent.primaryForeground,
            },
          );
          // Legacy `.is-sel` demoted the day LETTER to 70% white so it didn't
          // read as loud beside the full-white numeral. ENG-1572 exempt:
          // foreground-text opacity on a filled pill, not a border or tint.
          const letterColor = unifiedChrome
            ? tertiaryInk
            : selectedFill
              ? accent.primaryForeground + "B3"
              : secondaryColor;
          return (
            <PressableScale
              key={`${dateKeyFromDate(weekStart)}-${dk}`}
              haptic="selection"
              onPress={() => onSelectDate(clampJournalDate(date))}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={isProtected ? `Freeze used on ${dk}` : undefined}
              style={{
                flex: 1,
                alignItems: "center",
                gap: Spacing.xs,
                paddingVertical: 8,
                marginHorizontal: 1,
                borderRadius: Radius.xl,
                // Legacy v3 `.is-sel` floods the whole cell; "transparent"
                // under the flag, where the ring contains instead.
                backgroundColor: cellBg,
                // Out-of-range days genuinely are unavailable, so they keep the
                // fade. `dimFutureCell` is legacy-path only (flag OFF).
                opacity: outOfRange ? 0.35 : dimFutureCell ? 0.42 : 1,
              }}
            >
              <Text style={{ ...letterStyle, color: letterColor }}>{label}</Text>
              {/* Selection is a soft plum DISC behind the numeral, not a hairline
                  rounded rectangle.
                  A 1px grey rounded-rect around a number reads as a focused text
                  input or a spreadsheet cell — an affordance, not a state — and
                  it carried no brand colour at all. The disc is circular, which
                  is this app's signature geometry (the hero ring, the avatar
                  chip, the FAB, the macro dots), and it is tinted, so "selected"
                  is said in plum rather than in border-grey.
                  Sized 28pt so seven cells still fit the pager on a 375pt
                  screen, and filled rather than stroked so selecting can never
                  shift layout (no border box to occupy). */}
              <View
                testID={selectedRing ? "daystrip-selected-ring" : undefined}
                style={{
                  position: "relative",
                  minWidth: 28,
                  height: 28,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: Radius.full,
                  // SoftStrong (20%), not Soft (12%): at 12% over the Warm Oat
                  // ground the disc desaturates to a grey smudge and reads as
                  // chrome rather than as a plum state. 20% is the sanctioned
                  // step up and is the lightest value where the tint still
                  // reads as brand colour.
                  backgroundColor:
                    unifiedChrome && selectedRing ? accent.primarySoftStrong : "transparent",
                }}
              >
                <Text
                  style={{
                    ...numberStyle,
                    // Legacy carried selection/today in WEIGHT, not a ring.
                    fontWeight: unifiedChrome
                      ? numberStyle.fontWeight
                      : selectedFill || numberTone === "today"
                        ? "700"
                        : "600",
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
                      backgroundColor: accent.cyanSoftStrong,
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
            </PressableScale>
          );
        })}
      </View>
    ),
    [pagerW, dowLabels, selectedDk, todayDk, loggedDays, protectedDateKeys, min, max, textColor, secondaryColor, tertiaryInk, colors.border, unifiedChrome, letterStyle, numberStyle, onSelectDate, accent],
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
        <PressableScale
          haptic="selection"
          onPress={() => goViewWeek(-1)}
          disabled={prevDisabled}
          accessibilityRole="button"
          accessibilityLabel="Previous week"
          hitSlop={8}
          style={{ padding: 6, opacity: prevDisabled ? 0.3 : 1 }}
        >
          <ChevronLeft size={IconSize.lg} color={chevronColor} strokeWidth={chevronStroke} />
        </PressableScale>
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
        <PressableScale
          haptic="selection"
          onPress={() => goViewWeek(1)}
          disabled={nextDisabled}
          accessibilityRole="button"
          accessibilityLabel="Next week"
          hitSlop={8}
          style={{ padding: 6, opacity: nextDisabled ? 0.3 : 1 }}
        >
          <ChevronRight size={IconSize.lg} color={chevronColor} strokeWidth={chevronStroke} />
        </PressableScale>
        <PressableScale
          haptic="selection"
          onPress={onOpenCalendar}
          accessibilityRole="button"
          accessibilityLabel="Open calendar"
          hitSlop={10}
          style={{ padding: 8 }}
        >
          <Calendar size={IconSize.lg} color={accent.primary} strokeWidth={1.75} />
        </PressableScale>
      </View>
    </View>
  );
}
