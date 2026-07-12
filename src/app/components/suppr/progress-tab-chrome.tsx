"use client";

import type { ReactNode } from "react";

import { ScreenChrome } from "./screen-chrome";

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
 * ABOVE the serif plum "Progress" title. Thin wrapper over the shared
 * `ScreenChrome` since S6 (2026-07-10, ENG-1375) — which also moved the
 * title from its forked 28px down to the ONE serif-24 tab-title size.
 */
export function ProgressTabChrome({ overline, subtitle, trailing, className }: ProgressTabChromeProps) {
  return (
    <ScreenChrome
      overline={overline}
      title="Progress"
      subtitle={subtitle}
      trailing={trailing}
      className={className}
      testID="progress-tab-chrome"
      overlineTestID="progress-overline"
      titleTestID="progress-header"
    />
  );
}
