"use client";

import * as React from "react";
import { cn } from "./utils";

/**
 * `<SubTabPill>` — sub-tab navigation inside a primary tab group.
 *
 * 2026-05-19: Underline tab bar (editorial) replaces the segmented
 * pill-in-track control. Mobile mirror:
 * `apps/mobile/components/ui/SubTabPill.tsx`.
 */
export type SubTabItem<TId extends string = string> = {
  id: TId;
  label: string;
  badge?: number;
  accessibilityLabel?: string;
};

export interface SubTabPillProps<TId extends string = string> {
  items: ReadonlyArray<SubTabItem<TId>>;
  activeId: TId;
  onSelect: (id: TId) => void;
  accessibilityLabel: string;
  scrollable?: boolean;
  className?: string;
  /** Nested under screen chrome — tighter vertical padding. */
  embedded?: boolean;
}

export function SubTabPill<TId extends string>({
  items,
  activeId,
  onSelect,
  accessibilityLabel,
  scrollable = false,
  className,
  embedded = false,
}: SubTabPillProps<TId>) {
  const handleSelect = (id: TId) => {
    if (id === activeId) return;
    onSelect(id);
  };

  return (
    <div
      role="tablist"
      aria-label={accessibilityLabel}
      className={cn(
        "px-6 bg-background",
        embedded ? "pt-0" : "pt-1",
        scrollable ? "overflow-x-auto" : "",
        className,
      )}
    >
      <div
        className={cn(
          "flex border-b border-border",
          scrollable ? "min-w-max" : "",
        )}
      >
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={item.accessibilityLabel ?? item.label}
              data-testid={`subtab-${item.id}`}
              onClick={() => handleSelect(item.id)}
              className={cn(
                "relative flex-1 inline-flex items-center justify-center gap-1.5",
                "px-3 py-3 text-[15px] transition-colors -mb-px",
                "border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                active
                  ? "border-foreground text-foreground font-bold tracking-tight"
                  : "border-transparent text-muted-foreground font-medium hover:text-foreground",
                scrollable ? "min-w-[96px] shrink-0" : "",
              )}
            >
              <span>{item.label}</span>
              {item.badge !== undefined && item.badge > 0 ? (
                <span
                  className={cn(
                    "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold",
                    active
                      ? "bg-foreground text-background"
                      : "bg-border text-muted-foreground",
                  )}
                >
                  {item.badge > 999 ? "999+" : item.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default SubTabPill;
