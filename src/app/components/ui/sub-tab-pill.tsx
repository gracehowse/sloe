"use client";

import * as React from "react";
import { cn } from "./utils";

/**
 * `<SubTabPill>` — segmented pill bar primitive for sub-tab navigation
 * inside a primary tab group.
 *
 * Web mirror of `apps/mobile/components/ui/SubTabPill.tsx`. Same prop
 * shape; renders with Tailwind classes that match mobile's visual
 * tier (cardBorder track, primary-foreground active state).
 *
 * Background: see the mobile mirror's docblock and the teardown's
 * F5 finding (`docs/ux/teardown-2026-04-28-daily-loop.md`). Pre-
 * primitive, web's `App.tsx` carried two inline pill components
 * (`RecipesSubTabPill`, `YouSubTabPill`) that were near-clones of
 * each other AND of the mobile sub-tab headers. This primitive
 * replaces all of them.
 */
export type SubTabItem<TId extends string = string> = {
  id: TId;
  label: string;
  /** Optional unread / count badge (e.g. shopping unchecked count). */
  badge?: number;
  /** Override the accessibility label. Defaults to `label`. */
  accessibilityLabel?: string;
};

export interface SubTabPillProps<TId extends string = string> {
  items: ReadonlyArray<SubTabItem<TId>>;
  activeId: TId;
  onSelect: (id: TId) => void;
  /** Group accessibility label (announced as the tablist context). */
  accessibilityLabel: string;
  /** When `true`, allows the pill row to scroll horizontally if it
   *  overflows the container. Mobile-web on narrow viewports. */
  scrollable?: boolean;
  /** Optional outer-wrapper class — host typically adds layout
   *  margins (`mb-3`, `sticky top-0`, etc.) here without forking
   *  the primitive. */
  className?: string;
}

export function SubTabPill<TId extends string>({
  items,
  activeId,
  onSelect,
  accessibilityLabel,
  scrollable = false,
  className,
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
        "px-3 py-2",
        scrollable ? "overflow-x-auto" : "",
        className,
      )}
    >
      <div className="flex gap-1 rounded-md bg-muted p-1">
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={item.accessibilityLabel ?? item.label}
              onClick={() => handleSelect(item.id)}
              className={cn(
                "flex-1 inline-flex items-center justify-center gap-1.5 rounded-sm py-2.5 text-sm transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                active
                  ? "bg-card text-primary font-bold shadow-sm"
                  : "text-muted-foreground font-semibold hover:text-foreground",
                scrollable ? "min-w-[92px] px-2" : "",
              )}
            >
              <span>{item.label}</span>
              {item.badge !== undefined && item.badge > 0 ? (
                <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                  {item.badge > 99 ? "99+" : item.badge}
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
