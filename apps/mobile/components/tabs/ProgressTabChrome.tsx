import React, { type ReactNode } from "react";

import { ScreenSectionChrome } from "@/components/suppr/screen-section-chrome";

export interface ProgressTabChromeProps {
  /** Kept on the props for back-compat — callers still pass the range
   *  label ("LAST 30 DAYS"). Header now ignores it because the
   *  7d/30d/90d/All pills already on the page carry the same info,
   *  so the overline read as duplicated shouting (Grace 2026-05-22
   *  continuity sweep). Remove the prop in a later cleanup. */
  overline: string;
  trailing?: ReactNode;
}

/** Sticky Progress header — title only (range pills carry the time-window
 *  context on the body of the page). */
export function ProgressTabChrome({ trailing }: ProgressTabChromeProps) {
  return (
    <ScreenSectionChrome
      testID="progress-tab-chrome"
      titleTestID="progress-header"
      overline={null}
      title="Progress"
      trailing={trailing}
      compact
    />
  );
}

export default ProgressTabChrome;
