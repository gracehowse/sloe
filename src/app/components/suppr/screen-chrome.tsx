"use client";

import type { ReactNode } from "react";

import { isFeatureEnabled } from "@/lib/analytics/track";
import { cn } from "../ui/utils";

export interface ScreenChromeProps {
  /** Eyebrow above the title. Omit on tabs where the tab bar already carries
   *  the surface name. Under `design_consistency_v1` this renders the canonical
   *  treatment: 11/600/0.12em full-ink Inter + a hairline rule to the margin. */
  overline?: string | null;
  /** Opt out of the eyebrow hairline rule (e.g. when a trailing control sits on
   *  the same optical line and the rule would collide). Rule is on by default —
   *  one eyebrow treatment across the app is the point. */
  overlineRule?: boolean;
  title: string;
  /** Optional line under the title (e.g. week range on Plan). */
  subtitle?: string;
  /** Trailing control(s) aligned with the title row (e.g. calendar). */
  trailing?: ReactNode;
  /** Leading navigation control for pushed utility surfaces (e.g. Settings
   *  back). Parity with mobile `ScreenSectionChrome`. */
  leading?: ReactNode;
  /** Content below the title block, inside the sticky header (sub-tabs). */
  children?: ReactNode;
  /** Breakpoints this header serves. `"mobile"` keeps the legacy
   *  `md:hidden sticky` behaviour for surfaces whose desktop composition is
   *  still hand-rolled; `"all"` serves every breakpoint and is the migration
   *  target that retires those hand-rolled desktop twins. */
  scope?: "mobile" | "all";
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
 * ENG-1577 title ruling: the consistency path uses the 33px page-title token
 * across primary screens. The former serif 24px path remains as the rollout
 * kill switch.
 *
 * Breakpoint scope (design-consistency pass, 2026-07-24): this used to be
 * hard-coded `md:hidden`, so every desktop header — Library, Progress (twice),
 * Plan, Settings, Shopping, Create — hand-rolled the same eyebrow + serif title
 * + trailing-chip trio and drifted apart. `scope="all"` lets a surface use this
 * primitive at every breakpoint and retire its hand-rolled twin; `scope="mobile"`
 * (default) preserves the legacy behaviour for surfaces not yet migrated.
 */
export function ScreenChrome({
  overline,
  overlineRule = true,
  title,
  subtitle,
  trailing,
  leading,
  children,
  scope = "mobile",
  className,
  testID,
  overlineTestID,
  titleTestID,
}: ScreenChromeProps) {
  const consistencyChrome = isFeatureEnabled("primary_screen_chrome_v1");
  const unifiedChrome = isFeatureEnabled("design_consistency_v1");
  const servesDesktop = scope === "all";
  return (
    <header
      className={cn(
        "border-b border-border bg-background/95 backdrop-blur-md",
        // Desktop-serving headers scroll with the page — a sticky bar at 1440px
        // eats vertical room the mobile viewport does not have to spare.
        servesDesktop ? "md:static" : "md:hidden",
        "sticky top-0 z-40",
        className,
      )}
      data-testid={testID}
    >
      <div className="px-6 pt-3 pb-2 flex items-start justify-between gap-3">
        {leading ? <div className="shrink-0">{leading}</div> : null}
        <div className="min-w-0 flex-1 space-y-0.5">
          {overline ? (
            unifiedChrome && overlineRule ? (
              // The canonical eyebrow, promoted from the Today serif hero: full
              // ink (not tertiary) at 11/600/0.12em, followed by a hairline rule
              // running to the margin. The one distinctive piece of app chrome —
              // every surface now shares it instead of inventing its own.
              <div className="flex items-center gap-3 mb-1.5">
                <span
                  data-testid={overlineTestID}
                  className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground"
                >
                  {overline}
                </span>
                <span className="flex-1 h-px bg-border" />
              </div>
            ) : (
              <p
                data-testid={overlineTestID}
                className="text-[11px] font-bold uppercase tracking-[0.1em] text-foreground-tertiary"
              >
                {overline}
              </p>
            )
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
