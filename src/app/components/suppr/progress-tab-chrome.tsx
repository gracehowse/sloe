"use client";

import type { ReactNode } from "react";

import { cn } from "../ui/utils";

export interface ProgressTabChromeProps {
  overline: string;
  trailing?: ReactNode;
  className?: string;
}

/**
 * Sticky Progress header for mobile-web — mirrors mobile `ProgressTabChrome`.
 */
export function ProgressTabChrome({ overline, trailing, className }: ProgressTabChromeProps) {
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
            <p
              data-testid="progress-overline"
              className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground"
            >
              {overline}
            </p>
            <h1
              data-testid="progress-header"
              className="font-[family-name:var(--font-headline)] text-2xl font-medium tracking-tight text-foreground-brand"
            >
              Progress
            </h1>
          </div>
          {trailing}
        </div>
      </div>
    </header>
  );
}
