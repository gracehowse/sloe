"use client";

import * as React from "react";
import { Icons } from "../ui/icons";

/**
 * TodaySnapShortcut — small "Snap a meal" affordance rendered on
 * Today (web) above the macro tiles.
 *
 * Authority: audit 2026-04-30 (Lose It "Closer" parity — speed
 * loggers expect a one-tap photo entry point on Today, not buried
 * inside the LogSheet's right-edge icon row).
 *
 * Behaviour:
 *   - Click → host's `onPress` fires. Host decides Pro vs paywall.
 *   - When `locked`, a small lock badge surfaces the gate before tap.
 *   - Single-line, low-emphasis chrome — primary log entry stays the
 *     centred raised "+" in the bottom tab bar (`<SupprTabBar>`).
 *
 * Mobile mirror: `apps/mobile/components/today/TodaySnapShortcut.tsx`.
 */

export interface TodaySnapShortcutProps {
  onPress: () => void;
  /** Surface a small lock badge for free + base tier users so the
   *  Pro gate is visible before tap. The host still calls `onPress`
   *  (which decides whether to open PhotoLog or the paywall). */
  locked?: boolean;
  /** Optional Maestro / continuity testID. Defaults to the canonical
   *  `today-snap-shortcut` so cross-platform test suites can grep
   *  one name. */
  testID?: string;
  className?: string;
}

export function TodaySnapShortcut({
  onPress,
  locked = false,
  testID,
  className,
}: TodaySnapShortcutProps) {
  return (
    <button
      type="button"
      onClick={onPress}
      data-testid={testID ?? "today-snap-shortcut"}
      aria-label={locked ? "Snap a meal (Pro)" : "Snap a meal"}
      className={[
        "mb-3 w-full flex items-center gap-2 rounded-card bg-card card-slab-flat px-3 py-2.5 text-left",
        "hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Sloe treatment system (2026-06-08): soft-tint icon container
          (bg-primary/10 + primary-solid glyph). Mirror of mobile shutter. */}
      <span className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
        <Icons.camera className="h-4 w-4 text-primary-solid" aria-hidden />
        {locked ? (
          <span
            data-testid="today-snap-shortcut-lock"
            className="absolute -right-1 -top-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border-[1.5px] border-card bg-primary"
          >
            <Icons.lock className="h-2 w-2 text-primary-foreground" aria-hidden />
          </span>
        ) : null}
      </span>
      <span className="flex flex-col min-w-0">
        {/* 2026-05-13 (premium-bar audit Today F3 #3): when locked,
            pair the small corner-lock badge with an explicit "PRO"
            chip beside the title. The lock alone wasn't reading as
            a Pro gate — the chip makes the gate state unambiguous
            before the user clicks. Mobile mirror at
            `apps/mobile/components/today/TodaySnapShortcut.tsx`. */}
        <span className="flex items-center gap-1.5">
          <span className="text-[13px] font-bold text-foreground leading-tight">
            Snap a meal
          </span>
          {locked ? (
            <span
              data-testid="today-snap-shortcut-pro-chip"
              aria-label="Pro feature"
              // Sloe treatment system (2026-06-08): Pro badge = aubergine
              // soft-tint + primary-solid label, not a solid fill.
              className="inline-flex items-center rounded-sm bg-primary/10 px-1.5 py-px text-[9px] font-extrabold tracking-wider text-primary-solid"
            >
              PRO
            </span>
          ) : null}
        </span>
        {/* 2026-05-12 (premium-bar audit Today F3 #2): subtitle now
            carries the speed signal + the AI-estimate trust signal.
            Mobile mirrored in `apps/mobile/components/today/TodaySnapShortcut.tsx`. */}
        <span className="text-[11px] text-muted-foreground leading-tight mt-0.5">
          ~3 seconds · AI estimates macros, review before saving.
        </span>
      </span>
    </button>
  );
}

export default TodaySnapShortcut;
