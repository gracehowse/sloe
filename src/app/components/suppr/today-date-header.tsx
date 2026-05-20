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
  onOpenSettings: () => void;
  /** Premium P1 (ENG-584): hide day/week view toggle. */
  hideViewModeToggle?: boolean;
  /** Premium P1 (ENG-584): hide week day-strip row. */
  hideDayStrip?: boolean;
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
  onOpenSettings,
  hideViewModeToggle = false,
  hideDayStrip = false,
}: TodayDateHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4">
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
              if (hideDayStrip && viewMode === "day") {
                onOpenCalendar();
                return;
              }
              onSelectDateKey(todayKey());
              onViewModeChange("day");
            }}
            aria-label={
              hideDayStrip && viewMode === "day" ? "Choose date" : undefined
            }
          >
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium truncate">
              {viewMode === "week" ? (
                weekLabel
              ) : (
                <>
                  <span className="sm:hidden">
                    {selectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}{" "}
                    · {selectedDate.toLocaleDateString("en-US", { weekday: "short" })}
                  </span>
                  <span className="hidden sm:inline">
                    {selectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}{" "}
                    · {selectedDate.toLocaleDateString("en-US", { weekday: "long" })}
                  </span>
                </>
              )}
            </p>
            <h1
              className={`font-bold text-foreground ${
                hideDayStrip
                  ? "text-lg sm:text-xl whitespace-nowrap"
                  : "text-xl sm:text-2xl truncate"
              }`}
            >
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
          {hideDayStrip && viewMode === "day" && selectedDateKey !== todayKey() ? (
            <button
              type="button"
              onClick={() => {
                onSelectDateKey(todayKey());
                onViewModeChange("day");
              }}
              className="shrink-0 text-sm font-semibold text-primary hover:opacity-80"
            >
              Today
            </button>
          ) : null}
          {hideDayStrip && viewMode === "day" ? (
            <button
              type="button"
              onClick={onOpenCalendar}
              aria-label="Open calendar"
              className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border border-border bg-card"
            >
              <Icons.calendar className="w-4 h-4" />
            </button>
          ) : null}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* F-84 web parity (2026-04-25 sync-enforcer D-1) — mobile
              shipped a Sun/Grid icon-only toggle but web kept text labels.
              Same intent, same accessibility names; icon-only matches the
              prototype carryover and resolves the customer-lens
              "three time-navigation things" pile-up. */}
          {!hideViewModeToggle ? (
            <div className="flex rounded-lg border border-border bg-muted/50 p-0.5">
              <button
                type="button"
                onClick={() => onViewModeChange("day")}
                aria-label="Day view"
                aria-pressed={viewMode === "day"}
                className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
                  viewMode === "day" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
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
                  viewMode === "week" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icons.layoutGrid className="w-4 h-4" />
              </button>
            </div>
          ) : null}
          {/* Mobile-web only — desktop opens Settings from the sidebar
              profile entry (bottom-left), matching mobile’s Today avatar. */}
          <button
            type="button"
            onClick={onOpenSettings}
            className="md:hidden w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            aria-label="Open settings"
          >
            {avatarLetter}
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
    </div>
  );
}
