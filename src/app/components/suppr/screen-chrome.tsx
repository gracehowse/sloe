"use client";

import type { ReactNode } from "react";

import { isFeatureEnabled } from "@/lib/analytics/track";
import { cn } from "../ui/utils";

export interface ScreenChromeProps {
  /** Eyebrow above the title (11/700/uppercase tertiary). Omit on tabs
   *  where the tab bar already carries the surface name. */
  overline?: string | null;
  title: string;
  /** Optional line under the title (e.g. week range on Plan). */
  subtitle?: string;
  /** Trailing control(s) aligned with the title row (e.g. calendar). */
  trailing?: ReactNode;
  /** Content below the title block, inside the sticky header (sub-tabs). */
  children?: ReactNode;
  className?: string;
  testID?: string;
  overlineTestID?: string;
  titleTestID?: string;
}

/**
 * ScreenChrome — the ONE sticky mobile-web tab header (S6 chrome ruling,
 * 2026-07-10, ENG-1375). Web twin of mobile
 * `apps/mobile/components/suppr/screen-section-chrome.tsx`: overline →
 * serif title → optional subtitle, trailing slot, hairline bottom border.
 *
 * Title ruling: ONE tab-title size, serif 24 (`--font-headline`) — mobile
 * `Type.title` (24) is canonical; the old web Progress 28 forked sibling
 * tabs. Hidden at `md+` where the sidebar / desktop headers own navigation.
 */
export function ScreenChrome({
  overline,
  title,
  subtitle,
  trailing,
  children,
  className,
  testID,
  overlineTestID,
  titleTestID,
}: ScreenChromeProps) {
  const consistencyChrome = isFeatureEnabled("primary_screen_chrome_v1");
  return (
    <header
      className={cn(
        "md:hidden sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md",
        className,
      )}
      data-testid={testID}
    >
      <div className="px-6 pt-3 pb-2 flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          {overline ? (
            <p
              data-testid={overlineTestID}
              className="text-[11px] font-bold uppercase tracking-[0.1em] text-foreground-tertiary"
            >
              {overline}
            </p>
          ) : null}
          <h1
            data-testid={titleTestID}
            className={cn(
              "text-foreground-brand",
              consistencyChrome
                ? "page-title"
                : "font-[family-name:var(--font-headline)] text-[24px] font-medium leading-[1.1] tracking-tight",
            )}
          >
            {title}
          </h1>
          {subtitle ? (
            <p className="text-[13px] font-semibold text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {trailing ? (
          <div className="flex items-center gap-1 shrink-0">{trailing}</div>
        ) : null}
      </div>
      {children}
    </header>
  );
}
