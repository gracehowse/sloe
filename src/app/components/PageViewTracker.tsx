"use client";

import { useEffect } from "react";
import { track } from "../../lib/analytics/track.ts";
import type { AnalyticsEventName } from "../../lib/analytics/events.ts";

/** Client component that fires a single analytics event on mount. Use inside server-rendered pages. */
export function PageViewTracker({ event, properties }: { event: AnalyticsEventName; properties?: Record<string, unknown> }) {
  useEffect(() => {
    track(event, properties);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
