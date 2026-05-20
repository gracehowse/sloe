"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icons } from "./ui/icons";
import {
  addDaysLocal,
  clampJournalDate,
  dateKeyFromDate,
  dayIndexInWeek,
  enumerateWeekStartsInJournalRange,
  journalRangeBounds,
} from "../../lib/nutrition/journalNavigation.ts";
import { parseDateKey } from "../../lib/nutrition/trackerDate.ts";

type Props = {
  selectedDateKey: string;
  weekStartDay: "monday" | "sunday";
  loggedDays: ReadonlySet<string>;
  /**
   * Date keys where a streak freeze was consumed to absorb a zero-meal
   * day (2026-04-18 audit H7). Additive to the `loggedDays` styling —
   * tiles still render with the regular dot / active / today chrome;
   * the freeze glyph sits in the corner so the user learns the feature
   * actually worked ("Freeze used (Tue)"). Derived from
   * `computeProtectedStreak(...).protectedDateKeys` by the parent.
   */
  protectedDateKeys?: ReadonlySet<string>;
  onSelectDateKey: (key: string) => void;
  onOpenCalendar: () => void;
};

export function DayStrip({ selectedDateKey, weekStartDay, loggedDays, protectedDateKeys, onSelectDateKey, onOpenCalendar }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const [pagerW, setPagerW] = useState(0);
  const { min, max } = useMemo(() => journalRangeBounds(), []);
  const weekStarts = useMemo(() => enumerateWeekStartsInJournalRange(weekStartDay), [weekStartDay]);
  const selectedDk = selectedDateKey;
  const todayDk = dateKeyFromDate(new Date());

  // 2026-05-14 — reverted F5/F9 stacked-tile treatment back to
  // day-label-above-circle. Web parity with mobile DayStrip; Grace's
  // call that the stacked pills read as ovals and felt heavier than
  // the clean 30x30 circles.
  const dowLabels = useMemo(
    () =>
      weekStartDay === "monday"
        ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    [weekStartDay],
  );

  const weekIdx = useMemo(() => {
    for (let i = 0; i < weekStarts.length; i++) {
      const ws = weekStarts[i]!;
      const end = addDaysLocal(ws, 6);
      const startK = dateKeyFromDate(ws);
      const endK = dateKeyFromDate(end);
      if (selectedDk >= startK && selectedDk <= endK) return i;
    }
    return 0;
  }, [weekStarts, selectedDk]);

  const scrollToWeekIndex = useCallback(
    (index: number, behavior: ScrollBehavior) => {
      const el = scrollRef.current;
      if (!el || pagerW <= 0 || weekStarts.length === 0) return;
      const clamped = Math.max(0, Math.min(weekStarts.length - 1, index));
      el.scrollTo({ left: clamped * pagerW, behavior });
    },
    [pagerW, weekStarts.length],
  );

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = Math.round(el.clientWidth);
      if (w > 0) setPagerW(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (pagerW <= 0) return;
    scrollToWeekIndex(weekIdx, "instant");
  }, [weekIdx, pagerW, scrollToWeekIndex, selectedDk]);

  const handleScrollEnd = useCallback(() => {
    const el = scrollRef.current;
    if (!el || pagerW <= 0) return;
    const idx = Math.round(el.scrollLeft / pagerW);
    const clamped = Math.max(0, Math.min(weekStarts.length - 1, idx));
    const newWeekStart = weekStarts[clamped];
    if (!newWeekStart) return;
    const col = dayIndexInWeek(parseDateKey(selectedDk), weekStartDay);
    const next = clampJournalDate(addDaysLocal(newWeekStart, col));
    const nextKey = dateKeyFromDate(next);
    if (nextKey !== selectedDk) onSelectDateKey(nextKey);
  }, [pagerW, weekStarts, selectedDk, weekStartDay, onSelectDateKey]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        handleScrollEnd();
        debounce = null;
      }, 120);
    };
    el.addEventListener("scrollend", handleScrollEnd);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scrollend", handleScrollEnd);
      el.removeEventListener("scroll", onScroll);
      if (debounce) clearTimeout(debounce);
    };
  }, [handleScrollEnd]);

  const handleToday = useCallback(() => {
    onSelectDateKey(dateKeyFromDate(clampJournalDate(new Date())));
  }, [onSelectDateKey]);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleToday}
          className="shrink-0 py-2 px-1 text-sm font-bold text-primary hover:opacity-80"
        >
          Today
        </button>
        <div ref={rowRef} className="flex-1 min-w-0">
          <div
            ref={scrollRef}
            className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            {weekStarts.map((weekStart) => (
              <div
                key={dateKeyFromDate(weekStart)}
                className="min-w-full shrink-0 snap-center flex flex-row justify-between px-0.5 gap-0.5"
              >
                {dowLabels.map((label, i) => {
                  const date = addDaysLocal(weekStart, i);
                  const dk = dateKeyFromDate(date);
                  const isSelected = dk === selectedDk;
                  const isToday = dk === todayDk;
                  const hasLogs = loggedDays.has(dk);
                  const isProtected = protectedDateKeys?.has(dk) ?? false;
                  const outOfRange = date.getTime() < min.getTime() || date.getTime() > max.getTime();
                  return (
                    <button
                      key={dk}
                      type="button"
                      disabled={outOfRange}
                      onClick={() => onSelectDateKey(dateKeyFromDate(clampJournalDate(date)))}
                      aria-label={isProtected ? `Freeze used on ${dk}` : undefined}
                      className={`flex-1 flex flex-col items-center gap-1 py-1 ${outOfRange ? "opacity-35" : ""}`}
                    >
                      <span
                        className={`text-[10px] font-semibold tracking-wide leading-none ${
                          isSelected ? "text-primary" : "text-muted-foreground"
                        }`}
                      >
                        {label}
                      </span>
                      <div
                        className={[
                          "relative w-[30px] h-[30px] rounded-full flex items-center justify-center border-2 transition-colors",
                          isSelected
                            ? "bg-primary text-primary-foreground border-transparent"
                            : hasLogs
                              ? "bg-success/15 border-transparent text-foreground"
                              : "bg-transparent text-foreground border-transparent",
                          isToday && !isSelected ? "border-primary/40" : "",
                        ].join(" ")}
                      >
                        {hasLogs && !isSelected ? (
                          <Icons.check className="w-4 h-4 text-success" aria-hidden />
                        ) : (
                          <span className="text-[13px] font-bold tabular-nums">
                            {date.getDate()}
                          </span>
                        )}
                        {isProtected ? (
                          <Icons.streakFreeze
                            aria-hidden
                            className="absolute -top-1 -right-1 w-3 h-3 text-[color:var(--macro-water)] drop-shadow"
                          />
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenCalendar}
          className="shrink-0 p-2 rounded-lg text-primary hover:bg-muted"
          aria-label="Open calendar"
        >
          <Icons.calendarCheck className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
