"use client";

import * as React from "react";
import { CalendarPlus, Copy, Sunrise, type LucideIcon } from "lucide-react";

/** ENG-1247 — LogHub quick-action descriptor. Each entry is optional; the
 *  host omits an action when it isn't resolvable (no saved meals →
 *  `logUsual` undefined, yesterday empty → `copyYesterday` undefined, today
 *  empty → `duplicateDay` undefined) so the row renders no dead buttons. */
export type LogHubQuickActionsProps = {
  logUsual?: { mealName: string; onTap: () => void };
  copyYesterday?: { count: number; onTap: () => void };
  duplicateDay?: { onTap: () => void };
};

/**
 * v3 LogHub quick-action row — `Log {usual} / Copy yesterday / Duplicate
 * day`. Renders ONLY the actions whose handlers the host threaded (no dead
 * buttons). When every action is absent the row renders nothing. Mirror of
 * the mobile `LogHubQuickActions` in
 * `apps/mobile/components/today/LogHubQuickActions.tsx`.
 */
export function LogHubQuickActions({
  quickActions,
}: {
  quickActions: LogHubQuickActionsProps;
}) {
  const { logUsual, copyYesterday, duplicateDay } = quickActions;
  const actions: {
    key: "log-usual" | "copy-yesterday" | "duplicate-day";
    label: string;
    a11yLabel: string;
    Icon: LucideIcon;
    onTap: () => void;
  }[] = [];
  if (logUsual) {
    const label = `Log ${logUsual.mealName}`;
    actions.push({
      key: "log-usual",
      label,
      a11yLabel: label,
      Icon: Sunrise,
      onTap: logUsual.onTap,
    });
  }
  if (copyYesterday) {
    actions.push({
      key: "copy-yesterday",
      label: "Copy yesterday",
      a11yLabel:
        copyYesterday.count === 1
          ? "Copy yesterday's 1 meal to today"
          : `Copy yesterday's ${copyYesterday.count} meals to today`,
      Icon: Copy,
      onTap: copyYesterday.onTap,
    });
  }
  if (duplicateDay) {
    actions.push({
      key: "duplicate-day",
      label: "Duplicate day",
      a11yLabel: "Duplicate today to another day",
      Icon: CalendarPlus,
      onTap: duplicateDay.onTap,
    });
  }
  if (actions.length === 0) return null;
  return (
    <div className="flex gap-2 px-4 pb-3" data-testid="loghub-quick-actions">
      {actions.map(({ key, label, a11yLabel, Icon, onTap }) => (
        <button
          key={key}
          type="button"
          data-testid={`loghub-quick-${key}`}
          onClick={onTap}
          aria-label={a11yLabel}
          className="flex flex-1 min-w-0 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-1 py-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]"
        >
          <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="truncate">{label}</span>
        </button>
      ))}
    </div>
  );
}
