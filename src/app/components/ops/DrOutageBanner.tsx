"use client";

/**
 * DrOutageBanner — disaster-recovery kill-switch banner (web).
 *
 * Renders a fixed, top-of-app alert ONLY when the PostHog kill-switch
 * flag `dr-full-outage-banner` is ON. Default-OFF: nothing renders in
 * the normal case, so this is its own feature gate (CLAUDE.md flag rule).
 *
 * Copy is driven by the flag's PostHog payload ({ title?, body? } or a
 * plain string), so during an incident the message can change without a
 * deploy — see docs/runbooks/disaster-recovery.md § S2 / S7 + Pre-Phase-1
 * checklist row 7. Falls back to a safe default if the payload is empty.
 *
 * Mobile parity: apps/mobile/components/ops/DrOutageBanner.tsx.
 */

import { useEffect, useState } from "react";
import posthog from "posthog-js";

import { isFeatureEnabled, getFeatureFlagPayload } from "../../../lib/analytics/track.ts";

const FLAG = "dr-full-outage-banner";
const DEFAULT_BODY =
  "Sloe is temporarily having issues. We're on it — updates at status.suppr.club.";

type OutagePayload = { title?: string; body?: string };

function readPayload(): OutagePayload {
  const p = getFeatureFlagPayload(FLAG);
  if (p && typeof p === "object") return p as OutagePayload;
  if (typeof p === "string") return { body: p };
  return {};
}

export function DrOutageBanner() {
  const [enabled, setEnabled] = useState(false);
  const [payload, setPayload] = useState<OutagePayload>({});

  useEffect(() => {
    const sync = () => {
      setEnabled(isFeatureEnabled(FLAG));
      setPayload(readPayload());
    };
    sync();
    // PostHog loads flags asynchronously after init and on reload —
    // re-sync so the kill switch appears without a manual refresh.
    let unsub: () => void = () => {};
    try {
      unsub = posthog.onFeatureFlags(() => sync());
    } catch {
      /* PostHog not initialised (e.g. consent declined) — mount read stands */
    }
    return () => {
      try {
        unsub();
      } catch {
        /* noop */
      }
    };
  }, []);

  if (!enabled) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      data-testid="dr-outage-banner"
      className="fixed inset-x-0 top-0 z-[100] bg-destructive px-4 py-2 text-center text-sm font-medium text-destructive-foreground shadow-md"
    >
      {payload.title ? <span className="font-semibold">{payload.title} </span> : null}
      {payload.body || DEFAULT_BODY}
    </div>
  );
}

export default DrOutageBanner;
