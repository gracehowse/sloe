"use client";

import * as React from "react";

import { cn } from "./utils";
import { CountBadge } from "./count-badge";

/**
 * SegmentedTrack — THE §8 segmented control (ENG-1375 S2/S3, component-grammar
 * epic). One track-and-thumb treatment for every segmented control, ratified
 * 2026-07-10 (`docs/decisions/2026-07-10-chip-grammar-soft-tint.md`,
 * "Segmented controls" section):
 *
 *   - Track: `rounded-full bg-muted` rail with the 2px inner pad (`p-0.5`),
 *     and the same 2px gap between segments (`gap-0.5`, ENG-1608 — keeps the
 *     rail sliver uniform on every edge of the active thumb, not just the
 *     outer track boundary).
 *   - Active segment: card-white `rounded-full` thumb + `shadow-sm` (legal
 *     under the interactive-elevation carve-out in
 *     `2026-07-10-card-grammar-rounder-flat.md` — a thumb is feedback chrome,
 *     not a resting card).
 *   - Active label: `text-primary-solid font-semibold`. Inactive:
 *     `text-muted-foreground font-medium`.
 *
 * Renders as a `tablist` (view switches, default) or `radiogroup` (form
 * inputs) with roving tabindex + arrow-key movement, matching the mobile
 * accessibility contract.
 *
 * Deliberately NOT this primitive: CookMode's A−/A+ text-size stepper — that
 * is a stepper (increment/decrement), not a single-select track; documented
 * as intentionally-different in the ruling.
 *
 * Mobile mirror: `apps/mobile/components/ui/SegmentedTrack.tsx`.
 */

export type SegmentedTrackOption<T extends string = string> = {
  value: T;
  label: React.ReactNode;
  /** Spoken label when the visual one is terse (e.g. "W" → "Weekly"). */
  ariaLabel?: string;
  /** Optional count badge after the label (ENG-1532 amendment — the Plan
   *  Shopping unchecked count). Hidden at 0; caps at "999+" (the ratified
   *  cross-platform cap; mobile SegmentedTrack matches). Pill treatment
   *  copied from SubTabPill's badge. */
  badge?: number;
  testId?: string;
};

export type SegmentedTrackProps<T extends string = string> = {
  options: ReadonlyArray<SegmentedTrackOption<T>>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  /** `tablist` for view switches (default); `radiogroup` for form inputs. */
  role?: "tablist" | "radiogroup";
  /** `sm` = compact (11px, e.g. the Trend/Scale toggle); `md` = default (13px). */
  size?: "sm" | "md";
  /** `stretch` (default): segments share the track width (`flex-1`).
   *  `hug`: the track hugs its labels (inline pill). */
  fit?: "stretch" | "hug";
  className?: string;
  testId?: string;
};

export function SegmentedTrack<T extends string = string>({
  options,
  value,
  onChange,
  ariaLabel,
  role = "tablist",
  size = "md",
  fit = "stretch",
  className,
  testId,
}: SegmentedTrackProps<T>) {
  const isTablist = role === "tablist";

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const idx = options.findIndex((o) => o.value === value);
    if (idx < 0) return;
    const next =
      e.key === "ArrowRight"
        ? options[(idx + 1) % options.length]
        : options[(idx - 1 + options.length) % options.length];
    onChange(next.value);
  };

  return (
    <div
      role={role}
      aria-label={ariaLabel}
      data-testid={testId}
      onKeyDown={onKeyDown}
      className={cn(
        // §8 track: full-radius muted rail, 2px inner pad. ENG-1608: the
        // matching 2px `gap-0.5` between segments keeps the rail sliver
        // uniform on every edge of the active thumb — pre-fix, segments sat
        // flush against each other and the shadowed thumb read as colliding
        // with its neighbour.
        "rounded-full bg-muted p-0.5 gap-0.5",
        fit === "stretch" ? "flex" : "inline-flex",
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role={isTablist ? "tab" : "radio"}
            aria-selected={isTablist ? active : undefined}
            aria-checked={isTablist ? undefined : active}
            aria-label={opt.ariaLabel}
            tabIndex={active ? 0 : -1}
            data-testid={opt.testId}
            onClick={() => {
              if (!active) onChange(opt.value);
            }}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
              fit === "stretch" && "flex-1",
              size === "sm" ? "px-3 py-1 text-[11px]" : "py-1.5 text-[13px]",
              size === "md" && fit === "hug" && "px-4",
              // §8 thumb: card-white lift + subtle shadow; active label is the
              // aubergine solid, semibold.
              active
                ? "bg-card font-semibold text-primary-solid shadow-sm"
                : "font-medium text-muted-foreground hover:text-foreground",
            )}
          >
            <span>{opt.label}</span>
            {opt.badge !== undefined && opt.badge > 0 ? (
              <CountBadge count={opt.badge} active={active} />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
