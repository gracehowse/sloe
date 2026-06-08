import React, { type ReactNode } from "react";

import { ScreenSectionChrome } from "@/components/suppr/screen-section-chrome";

export interface ProgressTabChromeProps {
  /** Optional, ignored — the header renders the calm subtitle (Sloe Figma
   *  492:2) and the 7d/30d/90d/All pills carry the range. Kept optional for
   *  back-compat; the old `LAST N DAYS` overline was retired in the redesign. */
  overline?: string;
  trailing?: ReactNode;
}

// Sloe Figma 492:2 — calm header subtitle under the serif "Progress"
// title. DESCRIPTIVE (what the surface holds), not the prototype's
// presumptuous "you're trending right where you want to be" — that would
// read false on an off-track week. Mirrors web `PROGRESS_HEADER_SUBTITLE`.
const PROGRESS_HEADER_SUBTITLE = "Your weight, weekly recap, and adaptive maintenance.";

/** Sticky Progress header — serif title + calm subtitle (Sloe Figma
 *  492:2). Range pills below carry the time-window context. */
export function ProgressTabChrome({ trailing }: ProgressTabChromeProps) {
  return (
    <ScreenSectionChrome
      testID="progress-tab-chrome"
      titleTestID="progress-header"
      overline={null}
      title="Progress"
      subtitle={PROGRESS_HEADER_SUBTITLE}
      trailing={trailing}
      compact
    />
  );
}

export default ProgressTabChrome;
