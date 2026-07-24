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
import { isFeatureEnabled } from "../../lib/analytics/track.ts";

/**
 * ENG-1291 — the TRUE horizontal stride of one week panel in the pager.
 *
 * The pager previously assumed each panel's width equals the scroller
 * viewport width (`pagerW`, the ResizeObserver measurement). At
 * mobile-web widths the real panel width can disagree with that integer
 * measurement by a few px; multiplied across ~160 week panels (3 years
 * of history) the write (`scrollTo`) landed whole WEEKS away from the
 * intended one — the strip showed a wrong week with no selected day.
 *
 * Deriving the stride from `scrollWidth / panelCount` uses the panels'
 * actual laid-out total, so the per-panel error is bounded by
 * `0.5 / panelCount` px instead of compounding. The same stride MUST be
 * used by both the write (scrollToWeekIndex) and the read-back
 * (handleScrollEnd) so they can't disagree. Falls back to the measured
 * viewport width before layout has produced a scrollWidth (e.g. first
 * paint, jsdom).
 */
function weekPanelStride(
  el: HTMLDivElement,
  panelCount: number,
  fallbackPagerW: number,
): number {
  if (panelCount > 0 && el.scrollWidth > 0) return el.scrollWidth / panelCount;
  return fallbackPagerW;
}

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
  // The week the pager is currently SHOWING (v3 prototype `.day-nav` chevrons,
  // ENG-1247) — distinct from the selected day's week so the chevrons can
  // browse weeks without moving the selection. Synced to `weekIdx` below.
  const [viewWeekIdx, setViewWeekIdx] = useState(0);
  const { min, max } = useMemo(() => journalRangeBounds(), []);
  const weekStarts = useMemo(() => enumerateWeekStartsInJournalRange(weekStartDay), [weekStartDay]);
  const selectedDk = selectedDateKey;
  const todayDk = dateKeyFromDate(new Date());
  // design_consistency_v1 — ring selection + single-meaning dot + future tint.
  // Flag OFF restores the 2026-06-24 v3 filled-cell treatment VERBATIM, so the
  // flag is a true kill switch rather than a hybrid with no selection
  // affordance. Every visual delta below is gated. Mirror of mobile `DayStrip`.
  const unifiedChrome = isFeatureEnabled("design_consistency_v1");
  // Twin of mobile's `Type.statLabel` day letter — and byte-identical to the
  // sibling week strip (`plan/PlanWeekStripV3`), which is the point of the pass.
  const letterBase = unifiedChrome
    ? "text-[11px] font-semibold uppercase tracking-[0.04em] leading-none"
    : "text-[10px] font-semibold uppercase tracking-wide leading-none";

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
      // ENG-1291 — stride from the panels' real layout, not the viewport
      // measurement (see weekPanelStride).
      const stride = weekPanelStride(el, weekStarts.length, pagerW);
      el.scrollTo({ left: clamped * stride, behavior });
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
    setViewWeekIdx(weekIdx);
  }, [weekIdx, pagerW, scrollToWeekIndex, selectedDk]);

  /** Step the VIEWED week via the prototype `.day-nav` chevrons (ENG-1247).
   *  Scrolls the pager only — selection is unchanged until the user taps a day. */
  const goViewWeek = useCallback(
    (delta: number) => {
      const next = Math.max(0, Math.min(weekStarts.length - 1, viewWeekIdx + delta));
      if (next === viewWeekIdx) return;
      setViewWeekIdx(next);
      scrollToWeekIndex(next, "smooth");
    },
    [viewWeekIdx, weekStarts.length, scrollToWeekIndex],
  );

  const handleScrollEnd = useCallback(() => {
    // Ignore settles from programmatic scrolls (see userScrollRef above).
    if (!userScrollRef.current) return;
    userScrollRef.current = false;
    const el = scrollRef.current;
    if (!el || pagerW <= 0) return;
    // ENG-1291 — read back with the SAME stride the write path uses so
    // the settle position maps to the week the user actually sees.
    const stride = weekPanelStride(el, weekStarts.length, pagerW);
    const idx = Math.round(el.scrollLeft / stride);
    const clamped = Math.max(0, Math.min(weekStarts.length - 1, idx));
    setViewWeekIdx(clamped);
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

  // v3 prototype `.day-strip` (ENG-1247): ‹ › week chevrons flank the pager;
  // the calendar icon stays for far-date jumps. The old "Today" jump button is
  // dropped — chevrons + calendar cover navigation and the prototype has none.
  const prevDisabled = viewWeekIdx <= 0;
  const nextDisabled = viewWeekIdx >= weekStarts.length - 1;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => goViewWeek(-1)}
          disabled={prevDisabled}
          aria-label="Previous week"
          className="shrink-0 p-1.5 rounded-lg text-foreground-tertiary hover:text-foreground-secondary hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <Icons.back className="w-[18px] h-[18px]" />
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
                  const isFuture = dk > todayDk;
                  // Every visual channel resolves in the shared
                  // `dayStripIndicator` so this component and mobile `DayStrip`
                  // cannot drift. Under design_consistency_v1: RING = selection,
                  // NUMBER tone = temporal state, DOT = has-data.
                  const { dotKind, numberTone, selectedRing, selectedFill, dimFutureCell } =
                    dayStripIndicator({
                      isSelected,
                      isToday,
                      hasLogs,
                      isFuture,
                      unifiedChrome,
                    });
                  // Under the flag: empty dot = the FAINT border hairline tone,
                  // never `foreground-tertiary` (a mid-grey that read as a hard
                  // dot on all seven days). Legacy had no empty slot at all, and
                  // inverted the logged dot to white on the plum fill.
                  const dotClass = unifiedChrome
                    ? dotKind === "sage"
                      ? "bg-success"
                      : "bg-border"
                    : dotKind === "onAccent"
                      ? "bg-primary-foreground"
                      : dotKind === "sage"
                        ? "bg-success"
                        : "bg-transparent";
                  // Twin of mobile's `Type.navTitle` numeral. Legacy carried
                  // selection/today in WEIGHT + the fill, not a ring.
                  const numberClass = unifiedChrome
                    ? `text-[18px] font-medium ${
                        numberTone === "selected"
                          ? "text-foreground"
                          : numberTone === "today"
                            ? "text-primary"
                            : numberTone === "future"
                              ? // "Not yet", not "unavailable" — a future day
                                // steps to the tertiary ink tint instead of
                                // fading the whole cell.
                                "text-foreground-tertiary"
                              : "text-foreground-secondary"
                      }`
                    : `text-sm ${
                        selectedFill
                          ? "font-bold text-primary-foreground"
                          : numberTone === "today"
                            ? "font-semibold text-primary"
                            : "font-normal text-foreground"
                      }`;
                  return (
                    <button
                      key={dk}
                      type="button"
                      disabled={outOfRange}
                      onClick={() => onSelectDateKey(dateKeyFromDate(clampJournalDate(date)))}
                      aria-label={isProtected ? `Freeze used on ${dk}` : undefined}
                      aria-current={isSelected ? "date" : undefined}
                      data-testid={`daystrip-dot-minimal-${dotKind}`}
                      className={`flex-1 min-w-0 flex flex-col items-center gap-1.5 py-2 rounded-xl ${
                        unifiedChrome
                          ? "transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:hover:bg-transparent"
                          : selectedFill
                            ? "bg-primary"
                            : ""
                      } ${outOfRange ? "opacity-35" : dimFutureCell ? "opacity-[0.42]" : ""}`}
                    >
                      <span
                        className={`${letterBase} ${
                          selectedFill ? "text-primary-foreground/70" : "text-foreground-tertiary"
                        }`}
                      >
                        {label}
                      </span>
                      {/* min-w-6 (not 7): flex items default to min-width:auto, so the
                          28px circle set each cell's floor — 7 cells × 28 + chrome = 212px
                          overflowing the ~190px pager at 390vw and clipping Sunday.
                          24px floor + min-w-0 cells lets the week genuinely fit.
                          Selection is a soft plum DISC behind the numeral, not a
                          hairline rounded rectangle: a 1px grey rounded-rect around
                          a number reads as a focused text input or a spreadsheet
                          cell — an affordance, not a state — and carried no brand
                          colour. The disc is circular, matching this app's
                          signature geometry (hero ring, avatar chip, FAB, macro
                          dots), and filled rather than stroked so selecting can
                          never shift layout. Mirror of mobile `charts/DayStrip`. */}
                      <div
                        data-testid={selectedRing ? "daystrip-selected-ring" : undefined}
                        className={`relative flex items-center justify-center min-w-6 h-7 ${
                          unifiedChrome
                            ? `rounded-full ${selectedRing ? "bg-primary-soft-strong" : ""}`
                            : ""
                        }`}
                      >
                        <span
                          className={`font-[family-name:var(--font-headline)] tabular-nums leading-none ${numberClass}`}
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
          onClick={() => goViewWeek(1)}
          disabled={nextDisabled}
          aria-label="Next week"
          className="shrink-0 p-1.5 rounded-lg text-foreground-tertiary hover:text-foreground-secondary hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <Icons.forward className="w-[18px] h-[18px]" />
        </button>
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
