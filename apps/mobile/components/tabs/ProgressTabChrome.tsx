import React, { type ReactNode } from "react";

import { ScreenSectionChrome } from "@/components/suppr/screen-section-chrome";

export interface ProgressTabChromeProps {
  trailing?: ReactNode;
}

/** Sticky Progress header — v3 prototype `Your trends` overline + serif
 *  "Progress" title (ENG-1247, 2026-06-24). The 7d/30d/90d/All pills below
 *  carry the range. Supersedes the Figma-era descriptive subtitle (Figma
 *  retired; the prototype `4946` is overline + title, no subtitle). */
export function ProgressTabChrome({ trailing }: ProgressTabChromeProps) {
  return (
    <ScreenSectionChrome
      testID="progress-tab-chrome"
      titleTestID="progress-header"
      overline="Your trends"
      title="Progress"
      trailing={trailing}
      compact
    />
  );
}

export default ProgressTabChrome;
