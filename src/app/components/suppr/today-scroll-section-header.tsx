"use client";

import * as React from "react";
import { cn } from "../ui/utils";

/**
 * Sloe Today scroll section header — Figma TD1/TD2 (`today-activity.html`,
 * `today-hydration.html`): Newsreader section title + long date subline,
 * then 20px (`gap-5`) before the first card in the section.
 *
 * Parity: `apps/mobile/components/today/TodayScrollSectionHeader.tsx`.
 */
export interface TodayScrollSectionHeaderProps {
  title: string;
  /** Omit on full Today scroll when the hero already shows the date. */
  subtitle?: string;
  testID?: string;
  className?: string;
}

export function TodayScrollSectionHeader({
  title,
  subtitle,
  testID,
  className,
}: TodayScrollSectionHeaderProps) {
  return (
    <header
      data-testid={testID}
      className={cn("mt-1 mb-5 flex flex-col gap-1", className)}
    >
      <h2 className="font-[family-name:var(--font-headline)] text-2xl font-medium tracking-tight text-primary">
        {title}
      </h2>
      {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
    </header>
  );
}

export default TodayScrollSectionHeader;
