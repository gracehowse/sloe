"use client";

import type { ReactNode } from "react";

import { cn } from "../ui/utils";

export interface ProgressTabChromeProps {
  /** v3 prototype `Your trends` eyebrow above the serif "Progress" title. */
  overline?: string;
  /** Optional soft line under the title (back-compat; the v3 header is
   *  overline + title, no subtitle). */
  subtitle?: string;
  trailing?: ReactNode;
  className?: string;
}

/**
 * Sticky Progress header for mobile-web — mirrors mobile `ProgressTabChrome`.
 *
 * v3 prototype (ENG-1247, 2026-06-24, node `4946`): a "Your trends" overline
 * ABOVE the serif plum "Progress" title. Supersedes the Figma-era descriptive
 * subtitle (Figma retired). The 7d/30d/90d/All pills below carry the range.
 */
export function ProgressTabChrome({ overline, subtitle, trailing, className }: ProgressTabChromeProps) {
  return (
    <header
      className={cn(
        "md:hidden sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md",
        className,
      )}
      data-testid="progress-tab-chrome"
    >
      <div className="px-6 pt-2 pb-2 space-y-0.5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            {overline ? (
              <p
                data-testid="progress-overline"
                className="text-[11px] font-bold uppercase tracking-[0.1em] text-foreground-tertiary"
              >
                {overline}
              </p>
            ) : null}
            <h1
              data-testid="progress-header"
              className="font-[family-name:var(--font-headline)] text-[28px] font-medium tracking-tight text-foreground-brand leading-tight"
            >
              Progress
            </h1>
            {subtitle ? (
              <p
                data-testid="progress-subtitle"
                className="text-[13px] text-muted-foreground"
              >
                {subtitle}
              </p>
            ) : null}
          </div>
          {trailing}
        </div>
      </div>
    </header>
  );
}
