"use client";

/**
 * TareAestheticGate — toggles the `tare-on` class on <body> based on a
 * three-tier resolution order. Web mirror of mobile
 * `apps/mobile/lib/tareAesthetic.ts` (`useTareEnabled` + the Settings
 * toggle wiring).
 *
 * Resolution (first match wins):
 *
 *   1. URL param `?tare=on` / `?tare=off` / `?tare=clear` (or empty)
 *   2. localStorage `suppr.tare-preview`
 *   3. PostHog feature flag `tare-aesthetic-v1`
 *
 * The URL-param is persisted into localStorage so the override
 * survives in-app navigation. We deliberately do NOT strip the param
 * from the address bar — leaves the visible "you're in preview mode"
 * signal. To drop the override explicitly, use `?tare=clear`.
 *
 * Mobile parity:
 *   - Mobile has no URL surface, so the AsyncStorage value is set
 *     directly by the Settings toggle (Settings → Display → "Preview
 *     new aesthetic"). The override mechanism is the same; only the
 *     entry point differs per platform.
 *
 * Pinned by `tests/unit/tareAestheticGate.test.tsx`.
 */

import { useEffect, useState, type ReactNode } from "react";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { usePathname } from "next/navigation";

const PREVIEW_STORAGE_KEY = "suppr.tare-preview";
type PreviewState = "on" | "off" | null;

function readUrlPreviewParam(): "on" | "off" | "clear" | null {
  if (typeof window === "undefined") return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("tare");
    if (raw == null) return null;
    if (raw === "on" || raw === "off") return raw;
    if (raw === "" || raw === "clear") return "clear";
    return null;
  } catch {
    return null;
  }
}

function readPreviewState(): PreviewState {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PREVIEW_STORAGE_KEY);
    if (raw === "on" || raw === "off") return raw;
    return null;
  } catch {
    return null;
  }
}

function writePreviewState(next: PreviewState): void {
  if (typeof window === "undefined") return;
  try {
    if (next === null) {
      window.localStorage.removeItem(PREVIEW_STORAGE_KEY);
    } else {
      window.localStorage.setItem(PREVIEW_STORAGE_KEY, next);
    }
  } catch {
    /* storage denied — preview reverts to flag-only on next page */
  }
}

export function TareAestheticGate({ children }: { children: ReactNode }) {
  const flagEnabled = useFeatureFlagEnabled("tare-aesthetic-v1");
  const pathname = usePathname();
  const [preview, setPreview] = useState<PreviewState>(() => readPreviewState());

  useEffect(() => {
    const param = readUrlPreviewParam();
    if (param === null) return;
    if (param === "clear") {
      writePreviewState(null);
      setPreview(null);
    } else {
      writePreviewState(param);
      setPreview(param);
    }
  }, [pathname]);

  const resolved: boolean =
    preview === "on" ? true : preview === "off" ? false : flagEnabled === true;

  useEffect(() => {
    if (typeof document === "undefined") return;
    const body = document.body;
    if (resolved) {
      body.classList.add("tare-on");
    } else {
      body.classList.remove("tare-on");
    }
  }, [resolved]);

  return <>{children}</>;
}
