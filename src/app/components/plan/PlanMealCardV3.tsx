"use client";

import * as React from "react";
import { Check, Flame, Lock, MoreHorizontal, UtensilsCrossed } from "lucide-react";

/**
 * PlanMealCardV3 — Sloe v3 Plan per-slot meal card.
 *
 * WEB parity twin of `apps/mobile/components/plan/PlanMealCardV3.tsx` (prototype
 * `plan-card` ~L4788-4794): a 48px thumb (recipe photo, or a tinted box +
 * utensil glyph when none), the slot label with a lock badge when locked, the
 * kcal, the recipe name, and a "Batch" chip or a quiet queued note. Behind
 * sloe_v3_plan.
 */
export interface PlanMealCardV3Props {
  /** Slot label, e.g. "Breakfast". */
  slot: string;
  name: string;
  kcal: number | null;
  imageUrl?: string | null;
  isLocked?: boolean;
  /** "batch" → a Batch chip; any other truthy string → a quiet queued note. */
  note?: string | null;
  /** When the user logged this planned meal on that day (diary match). */
  isCooked?: boolean;
  onPress?: () => void;
  /** ENG-1238 — per-meal action menu trigger. */
  onOpenOptions?: () => void;
}

export function PlanMealCardV3({
  slot,
  name,
  kcal,
  imageUrl,
  isLocked,
  note,
  isCooked,
  onPress,
  onOpenOptions,
}: PlanMealCardV3Props) {
  const [broken, setBroken] = React.useState(false);
  const showImage = Boolean(imageUrl) && !broken;
  return (
    <div
      className="mt-2 flex w-full items-center gap-3 rounded-xl border p-3"
      style={{
        backgroundColor: "var(--card)",
        borderColor: "var(--border)",
      }}
    >
      <button
        type="button"
        onClick={onPress}
        disabled={!onPress}
        aria-label={`${slot}: ${name}`}
        className="flex min-w-0 flex-1 items-center gap-3 text-left transition-[background-color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 enabled:hover:opacity-95 enabled:active:scale-[0.99] disabled:cursor-default"
        style={isCooked ? { opacity: 0.72 } : undefined}
      >
      <span
        className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg"
        style={{ backgroundColor: "var(--background-secondary)" }}
      >
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl ?? undefined}
            alt=""
            className="absolute inset-0 size-full object-cover"
            onError={() => setBroken(true)}
          />
        ) : (
          <UtensilsCrossed
            className="size-[18px] opacity-55"
            style={{ color: "var(--primary)" }}
          />
        )}
        {isCooked ? (
          <span
            className="absolute inset-0 flex items-center justify-center"
            style={{
              backgroundColor:
                "color-mix(in srgb, var(--accent-success-solid) 82%, transparent)",
            }}
            aria-hidden
          >
            <Check className="size-3.5 text-white" strokeWidth={2.5} />
          </span>
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-1">
          <span className="flex items-center gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.04em] text-foreground-tertiary">
              {slot}
            </span>
            {isLocked ? (
              <Lock
                className="size-2.5 text-foreground-tertiary"
                aria-label="Locked"
              />
            ) : null}
          </span>
          <span className="text-[13px] tabular-nums text-foreground-tertiary">
            {kcal ? `${kcal} kcal` : "—"}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-[13px] font-semibold text-foreground">
          {name}
        </span>
        {note === "batch" ? (
          <span className="mt-1 flex items-center gap-[3px]">
            <Flame className="size-3" style={{ color: "var(--accent-warning-solid)" }} />
            <span
              className="text-[10px] font-semibold uppercase tracking-[0.04em]"
              style={{ color: "var(--accent-warning-solid)" }}
            >
              Batch
            </span>
          </span>
        ) : note ? (
          <span
            className="mt-[3px] block text-[11px]"
            style={{ color: "var(--primary)" }}
          >
            {note}
          </span>
        ) : null}
      </span>
      </button>
      {onOpenOptions ? (
        <button
          type="button"
          onClick={onOpenOptions}
          aria-label={`${slot} meal options`}
          data-testid="plan-card-opt"
          className="shrink-0 rounded-lg p-2 text-foreground-tertiary hover:bg-[var(--background-secondary)]"
        >
          <MoreHorizontal className="size-[18px]" />
        </button>
      ) : null}
    </div>
  );
}

export default PlanMealCardV3;
