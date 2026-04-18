"use client";

import * as React from "react";
import { Icons } from "../ui/icons";
import { DayStrip } from "../DayStrip";
import { todayKey, formatDateLabel } from "../../../lib/nutrition/trackerDate";

/**
 * TodayDateHeader — day/week navigation, view-mode toggle, avatar,
 * and the `DayStrip` row.
 *
 * Extracted from `NutritionTracker.tsx` (audit H3, 2026-04-18). Pure
 * presentation; all state lives in the composition root.
 */
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
}

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
}: TodayDateHeaderProps) {
  return (
    <div className="mb-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            type="button"
            aria-label={viewMode === "week" ? "Previous week" : "Previous day"}
            onClick={onNavigatePrev}
            className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border border-border bg-card"
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
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium truncate">
              {viewMode === "week"
                ? weekLabel
                : `${selectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${selectedDate.toLocaleDateString("en-US", { weekday: "long" })}`}
            </p>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">
              {viewMode === "week" ? "This week" : formatDateLabel(selectedDate)}
            </h1>
          </button>
          <button
            type="button"
            aria-label={viewMode === "week" ? "Next week" : "Next day"}
            onClick={onNavigateNext}
            disabled={viewMode === "day" && selectedDateKey === todayKey()}
            className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border border-border bg-card disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Icons.forward className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex rounded-lg border border-border bg-muted/50 p-0.5">
            <button
              type="button"
              onClick={() => onViewModeChange("day")}
              className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${
                viewMode === "day" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              Day
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange("week")}
              className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${
                viewMode === "week" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              Week
            </button>
          </div>
          <div
            className="w-9 h-9 rounded-[10px] bg-primary/10 flex items-center justify-center text-sm font-bold text-primary"
            aria-hidden
          >
            {avatarLetter}
          </div>
        </div>
      </div>

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
    </div>
  );
}
