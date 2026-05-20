import React, { type ReactNode } from "react";

import { ScreenSectionChrome } from "@/components/suppr/screen-section-chrome";

export interface ProgressTabChromeProps {
  overline: string;
  trailing?: ReactNode;
}

/** Sticky Progress header — brand + range overline + Progress title. */
export function ProgressTabChrome({ overline, trailing }: ProgressTabChromeProps) {
  return (
    <ScreenSectionChrome
      testID="progress-tab-chrome"
      overlineTestID="progress-overline"
      titleTestID="progress-header"
      overline={overline}
      title="Progress"
      trailing={trailing}
    />
  );
}

export default ProgressTabChrome;
