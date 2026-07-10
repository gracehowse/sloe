"use client";

import * as React from "react";
import { Icons } from "../ui/icons";
import { AvatarDisc } from "../ui/avatar-disc";
import { DayStrip } from "../DayStrip";
import { StreakPip } from "./streak-pip";
import { todayKey, formatDateLabel } from "../../../lib/nutrition/trackerDate";

export interface TodayDateHeaderProps {
  viewMode: "day" | "week";
  onViewModeChange: (mode: "day" | "week") => void;
  selectedDate: Date;
  selectedDateKey: string;
  onSelectDateKey: (k: string) => void;
  weekLabel: string;
  weekStartDay: "monday" | "sunday";
  loggedDays: Set<string>;
  protectedDateKeys: Set<string>;
  avatarLetter: string;
  onNavigatePrev: () => void;
  onNavigateNext: () => void;
  onOpenCalendar: () => void;
  onOpenSettings: () => void;
  hideViewModeToggle?: boolean;
  hideDayStrip?: boolean;
  /** Sloe Today — week strip only (no chevrons / title / avatar). */
  stripOnly?: boolean;
  dayGreeting?: string;
  streakDays?: number;
  freezeProtected?: boolean;
  onStreakPress?: () => void;
  /** ENG-1504 (mobile parity, premium-bar audit DC8) — when the protected
   *  streak just reset, render the calm supportive line under the day strip.
   *  Sticky until the user next logs a positive streak (host-managed).
   *  Mirrors mobile `TodayDateHeader`'s `streakResetCopyVisible`. */
  streakResetCopyVisible?: boolean;
}

const ghostNav =
  "w-7 h-7 shrink-0 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors";

const chromeNav =
  "w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border border-border bg-card";

export function TodayDateHeader({
  viewMode,
  onViewModeChange,
  selectedDate,
  selectedDateKey,
  onSelectDateKey,
  weekLabel,
  weekStartDay,
  loggedDays,
  protectedDateKeys,
  avatarLetter,
  onNavigatePrev,
  onNavigateNext,
  onOpenCalendar,
  onOpenSettings,
  hideViewModeToggle = false,
  hideDayStrip = false,
  stripOnly = false,
  dayGreeting,
  streakDays,
  freezeProtected,
  onStreakPress,
  streakResetCopyVisible = false,
}: TodayDateHeaderProps) {
  const calmDateNav = hideDayStrip && viewMode === "day";
  const isToday = selectedDateKey === todayKey();

  // ENG-1504 — mobile-canonical fresh-day nudge (premium-bar audit DC8):
  // the streak-reset supportive line renders in the date-header block,
  // directly under the day strip. Copy + position mirror mobile
  // `TodayDateHeader` exactly.
  const streakResetLine = (
    <p data-testid="streak-reset-copy" className="text-[11px] text-muted-foreground">
      Every expert was once a beginner. Start fresh today.
    </p>
  );

  if (stripOnly) {
    // Sloe redesign (2026-06-08): airier rhythm to match Figma `654:2`
    // (`mb-7` ≈ 28px between the week strip and the ring hero). `mb-5`
    // (20px) + the host `space-y-3` (12px) ≈ the frame's strip→hero gap;
    // replaces the cramped `mb-2`. Mirrors the mobile `marginBottom`
    // bump in `(tabs)/index.tsx`.
    return (
      <div className="mb-5 flex flex-col gap-1">
        <DayStrip
          selectedDateKey={selectedDateKey}
          weekStartDay={weekStartDay}
          loggedDays={loggedDays}
          protectedDateKeys={protectedDateKeys}
          onSelectDateKey={onSelectDateKey}
          onOpenCalendar={onOpenCalendar}
        />
        {isToday && streakResetCopyVisible ? streakResetLine : null}
      </div>
    );
  }
  const showStreakPip =
    viewMode === "day" &&
    isToday &&
    typeof streakDays === "number" &&
    streakDays >= 2;
  const titleText =
    viewMode === "week" ? "This week" : formatDateLabel(selectedDate);

  if (calmDateNav) {
    return (
      <div className="mb-2 flex flex-col gap-1.5">
        <div className="flex items-center gap-1 min-w-0">
          <button type="button" aria-label="Previous day" onClick={onNavigatePrev} className={ghostNav}>
            <Icons.back className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1 px-0.5">
            <button
              type="button"
              className="w-full text-left"
              onClick={onOpenCalendar}
              aria-label="Choose date"
            >
              {/* S6 chrome title ruling (2026-07-10, ENG-1375): sans-bold →
                  the ONE serif-24 tab-title voice (`ScreenChrome` grammar,
                  mobile `Type.title`). */}
              <h1 className="font-[family-name:var(--font-headline)] text-[24px] font-medium leading-[1.1] tracking-tight text-foreground-brand truncate">
                {titleText}
              </h1>
              {dayGreeting && isToday ? (
                <p data-testid="today-greeting" className="text-[11px] text-muted-foreground mt-0.5 truncate">
                  {dayGreeting}
                </p>
              ) : null}
            </button>
            {!isToday ? (
              <button
                type="button"
                onClick={() => {
                  onSelectDateKey(todayKey());
                  onViewModeChange("day");
                }}
                className="text-[11px] font-semibold text-primary-solid hover:opacity-80 mt-0.5"
              >
                Jump to today
              </button>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="Next day"
            onClick={onNavigateNext}
            disabled={isToday}
            className={`${ghostNav} disabled:opacity-20 disabled:cursor-not-allowed`}
          >
            <Icons.forward className="w-5 h-5" />
          </button>
          {showStreakPip ? (
            <StreakPip
              days={streakDays!}
              freezeProtected={freezeProtected}
              onPress={onStreakPress}
            />
          ) : null}
          <button
            type="button"
            onClick={onOpenSettings}
            className="md:hidden shrink-0 rounded-full"
            aria-label="Open settings"
          >
            <AvatarDisc initial={avatarLetter} size={36} />
          </button>
        </div>
        {streakResetCopyVisible ? streakResetLine : null}
      </div>
    );
  }

  return (
    <div className="mb-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            type="button"
            aria-label={viewMode === "week" ? "Previous week" : "Previous day"}
            onClick={onNavigatePrev}
            className={chromeNav}
          >
            <Icons.back className="w-4 h-4" />
          </button>
          <button
            type="button"
            className="text-center min-w-0 flex-1"
            onClick={() => {
              onSelectDateKey(todayKey());
              onViewModeChange("day");
            }}
          >
            {viewMode === "week" ? (
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium truncate">
                {weekLabel}
              </p>
            ) : null}
            {/* S6 chrome title ruling (2026-07-10, ENG-1375): sans-bold →
                the ONE serif-24 tab-title voice (`ScreenChrome` grammar). */}
            <h1 className="font-[family-name:var(--font-headline)] text-[24px] font-medium leading-[1.1] tracking-tight text-foreground-brand truncate">
              {titleText}
            </h1>
            {dayGreeting && viewMode === "day" && isToday ? (
              <p data-testid="today-greeting" className="text-[11px] text-muted-foreground mt-0.5">
                {dayGreeting}
              </p>
            ) : null}
          </button>
          <button
            type="button"
            aria-label={viewMode === "week" ? "Next week" : "Next day"}
            onClick={onNavigateNext}
            disabled={viewMode === "day" && isToday}
            className={`${chromeNav} disabled:opacity-30 disabled:cursor-not-allowed`}
          >
            <Icons.forward className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Sloe treatment system (2026-06-08): segmented control
              active segment = soft-tint lift (bg-primary/10) + primary-solid
              icon; inactive = muted glyph on the warm-grey rail. Mirror
              of mobile `TodayDateHeader`. */}
          {!hideViewModeToggle ? (
            <div className="flex rounded-lg border border-border bg-muted/50 p-0.5">
              <button
                type="button"
                onClick={() => onViewModeChange("day")}
                aria-label="Day view"
                aria-pressed={viewMode === "day"}
                className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
                  viewMode === "day"
                    ? "bg-primary/10 text-primary-solid shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icons.lightMode className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange("week")}
                aria-label="Week view"
                aria-pressed={viewMode === "week"}
                className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
                  viewMode === "week"
                    ? "bg-primary/10 text-primary-solid shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icons.layoutGrid className="w-4 h-4" />
              </button>
            </div>
          ) : null}
          <button
            type="button"
            onClick={onOpenSettings}
            className="md:hidden shrink-0 rounded-full"
            aria-label="Open settings"
          >
            <AvatarDisc initial={avatarLetter} size={36} />
          </button>
        </div>
      </div>

      {!hideDayStrip ? (
        <DayStrip
          selectedDateKey={selectedDateKey}
          weekStartDay={weekStartDay}
          loggedDays={loggedDays}
          protectedDateKeys={protectedDateKeys}
          onSelectDateKey={
            viewMode === "day"
              ? onSelectDateKey
              : (k) => {
                  onSelectDateKey(k);
                  onViewModeChange("day");
                }
          }
          onOpenCalendar={onOpenCalendar}
        />
      ) : null}
      {viewMode === "day" && isToday && streakResetCopyVisible
        ? streakResetLine
        : null}
    </div>
  );
}
