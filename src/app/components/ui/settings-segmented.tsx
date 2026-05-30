"use client";

import * as React from "react";
import { cn } from "./utils";

/**
 * `<SettingsSegmented>` — full-width segmented control used inside the
 * Preferences card on Settings.tsx. Five sites used to render five
 * slightly-different variants of `flex-1 px-4 py-3 rounded-xl border-2
 * …` with diverging hover / active states. This primitive collapses
 * them into one (audit 2026-04-30 P1-7).
 *
 * Distinct from `<Segmented>` (`onboarding/segmented.tsx`) — that one
 * is a small inline pill used during onboarding. This one is a
 * 48px-tall row that fills its container.
 *
 * Active state: `border-primary bg-primary/10 text-foreground` — selection
 * is carried by the border + tint, not by recolouring the label, so the
 * selected segment keeps full text contrast (matches the OptionCard
 * precedent; `text-primary` on its own `bg-primary/10` tint fails WCAG AA
 * for normal-weight text). Inactive: `border-border text-foreground
 * hover:border-primary/30`. Each option may carry an optional `hint`
 * rendered beneath the main label.
 *
 * Renders as a `radiogroup` so screen readers and keyboard users behave
 * correctly. Arrow keys move the selection (matches the onboarding
 * Segmented primitive).
 */

export type SettingsSegmentedOption<T extends string> = {
  value: T;
  label: React.ReactNode;
  hint?: React.ReactNode;
  /** Optional override for the wrapper data-testid. */
  testId?: string;
};

export type SettingsSegmentedProps<T extends string> = {
  options: ReadonlyArray<SettingsSegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  /** Use a 3-column grid instead of a flex row. The "How weight shows up"
   *  picker needs the grid layout because the third option's hint is
   *  longer than the row form can absorb without wrapping awkwardly. */
  layout?: "row" | "grid-3";
  className?: string;
  /** Wrapper data-testid (e.g. for the existing
   *  `weight-surface-mode-picker` selector). */
  testId?: string;
};

export function SettingsSegmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  layout = "row",
  className,
  testId,
}: SettingsSegmentedProps<T>) {
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
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      data-testid={testId}
      className={cn(
        layout === "grid-3"
          ? "grid grid-cols-3 gap-2"
          : "flex gap-3",
        className,
      )}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            data-testid={opt.testId}
            onClick={() => onChange(opt.value)}
            className={cn(
              "px-4 py-3 rounded-xl border-2 transition-all text-left",
              layout === "row" && "flex-1",
              selected
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border hover:border-primary/30 text-foreground",
            )}
          >
            <div className="text-sm font-semibold">{opt.label}</div>
            {opt.hint ? (
              <div className="text-[11px] mt-0.5 text-muted-foreground">
                {opt.hint}
              </div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
