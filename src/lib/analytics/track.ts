"use client";

import posthog from "posthog-js";
import type { AnalyticsEventName } from "./events.ts";

export function track(event: AnalyticsEventName, props?: Record<string, unknown>): void {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  try {
    posthog.capture(event, props);
  } catch {
    /* ignore */
  }
}
