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
import { dayStripIndicator } from "../../lib/today/dayStripIndicator.ts";
import { weekdayInitials } from "../../lib/today/weekdayLabels.ts";

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
  // ENG-1008 parity (2026-06-10): only user-initiated scrolls may write the
  // selected date back from scroll position. Programmatic `scrollTo` (the
  // align effect) also fires scroll/scrollend; if layout is mid-flight the
  // readback can disagree with the intended week and overwrite a correct
  // calendar/deep-link date (the mobile FlatList-clamp bug, same class).
  // User intent is detected via wheel/touch/pointer on the scroller.
  const userScrollRef = useRef(false);
  const [pagerW, setPagerW] = useState(0);
  const { min, max } = useMemo(() => journalRangeBounds(), []);
  const weekStarts = useMemo(() => enumerateWeekStartsInJournalRange(weekStartDay), [weekStartDay]);
  const selectedDk = selectedDateKey;
  const todayDk = dateKeyFromDate(new Date());

  // Sloe redesign (2026-06-08) — single-letter weekday labels to match the
  // canonical Figma `654:2` Today frame (`S M T W T F S`), replacing the
  // 2026-05-14 three-letter `Mon/Tue/Wed` treatment. The day NUMBER below the
  // letter disambiguates the date. Shared with mobile `DayStrip` via
  // `weekdayInitials` so the two surfaces can't drift.
  const dowLabels = useMemo(
    () => weekdayInitials(weekStartDay),
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
    // Ignore settles from programmatic scrolls (see userScrollRef above).
    if (!userScrollRef.current) return;
    userScrollRef.current = false;
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
    const markUserScroll = () => {
      userScrollRef.current = true;
    };
    el.addEventListener("wheel", markUserScroll, { passive: true });
    el.addEventListener("touchstart", markUserScroll, { passive: true });
    el.addEventListener("pointerdown", markUserScroll, { passive: true });
    el.addEventListener("scrollend", handleScrollEnd);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("wheel", markUserScroll);
      el.removeEventListener("touchstart", markUserScroll);
      el.removeEventListener("pointerdown", markUserScroll);
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
            {weekStarts.map((weekStart, weekIndex) => (
              <div
                key={dateKeyFromDate(weekStart)}
                {...(weekIndex !== weekIdx ? { inert: true } : {})}
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
                  // Minimal current-day treatment (2026-06-03, Grace's
                  // feedback — the filled clay circle read as clunky). Web
                  // parity with mobile `DayStrip`: the active day is a clay
                  // (`text-primary`) bold NUMBER with a small clay DOT beneath,
                  // NO filled background. Logged days carry a sage dot; the
                  // clay (selected) indicator takes precedence on the both-case.
                  // The state→treatment rule is shared via `dayStripIndicator`.
                  // §7 (2026-06-10): soft-tint pill carries selection — see
                  // dayStripIndicator.ts for the treatment history.
                  const { dotKind, isActive, showsPill } = dayStripIndicator({
                    isSelected,
                    isToday,
                    hasLogs,
                  });
                  const dotClass =
                    dotKind === "clay"
                      ? "bg-primary"
                      : dotKind === "sage"
                        ? "bg-success"
                        : "bg-transparent";
                  return (
                    <button
                      key={dk}
                      type="button"
                      disabled={outOfRange}
                      onClick={() => onSelectDateKey(dateKeyFromDate(clampJournalDate(date)))}
                      aria-label={isProtected ? `Freeze used on ${dk}` : undefined}
                      data-testid={`daystrip-dot-minimal-${dotKind}`}
                      className={`flex-1 flex flex-col items-center gap-1.5 py-2 ${outOfRange ? "opacity-35" : ""}`}
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-wide leading-none text-foreground-tertiary">
                        {label}
                      </span>
                      <div
                        className={[
                          "relative flex items-center justify-center min-w-7 h-7 rounded-full",
                          showsPill ? "bg-primary-soft" : "bg-transparent",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "font-[family-name:var(--font-headline)] text-sm tabular-nums leading-none",
                            isActive ? "font-semibold text-primary" : "font-normal text-foreground",
                          ].join(" ")}
                        >
                          {date.getDate()}
                        </span>
                        {isProtected ? (
                          <Icons.streakFreeze
                            aria-hidden
                            className="absolute -top-1.5 -right-2.5 w-3 h-3 text-[color:var(--macro-water)] drop-shadow"
                          />
                        ) : null}
                      </div>
                      <span
                        className={`block w-1 h-1 rounded-full ${dotClass}`}
                        aria-hidden
                      />
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
