"use client";

import type { ReactNode } from "react";

import { cn } from "../ui/utils";

export interface ProgressTabChromeProps {
  /** Range label kept for back-compat; the Sloe Figma 492:2 header shows
   *  a calm subtitle instead of a shouty overline. Pass `subtitle` to use
   *  the new chrome. */
  overline?: string;
  /** Sloe Figma 492:2 — soft line under the serif "Progress" title. */
  subtitle?: string;
  trailing?: ReactNode;
  className?: string;
}

/**
 * Sticky Progress header for mobile-web — mirrors mobile `ProgressTabChrome`.
 *
 * Sloe Figma 492:2 — serif plum "Progress" title with a calm subtitle
 * underneath (the prior uppercase range overline read as redundant
 * shouting against the 7d/30d/90d/All pills below; replaced to match
 * the Figma header block).
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
            ) : overline ? (
              <p
                data-testid="progress-overline"
                className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground"
              >
                {overline}
              </p>
            ) : null}
          </div>
          {trailing}
        </div>
      </div>
    </header>
  );
}
