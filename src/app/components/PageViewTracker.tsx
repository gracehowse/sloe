"use client";

import { useEffect, useRef } from "react";
import { track } from "../../lib/analytics/track.ts";
import type { AnalyticsEventName } from "../../lib/analytics/events.ts";

/** Client component that fires a single analytics event on mount. Use inside server-rendered pages. */
export function PageViewTracker({ event, properties }: { event: AnalyticsEventName; properties?: Record<string, unknown> }) {
  useEffect(() => {
    track(event, properties);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/**
 * T22 (full-sweep 2026-04-24): emit a single analytics event on
 * unmount (page leave / SPA route change). Pairs with `PageViewTracker`
 * so funnels with mandatory dismissal counterparts (e.g. `paywall_viewed`
 * + `paywall_dismissed`) get a consistent denominator. Fires once
 * regardless of unmount cause.
 */
export function PageDismissTracker({
  event,
  properties,
}: {
  event: AnalyticsEventName;
  properties?: Record<string, unknown>;
}) {
  // Capture properties at mount so the closure has a stable snapshot
  // — by the time the cleanup runs, the parent may have already
  // dropped its `properties` reference.
  const propsRef = useRef(properties);
  const eventRef = useRef(event);
  useEffect(() => {
    return () => {
      track(eventRef.current, propsRef.current);
    };
  }, []);
  return null;
}
