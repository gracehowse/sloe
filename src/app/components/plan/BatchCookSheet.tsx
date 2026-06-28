"use client";

import * as React from "react";
import { ChefHat, ChevronRight } from "lucide-react";

import { isFeatureEnabled } from "../../../lib/analytics/track.ts";

export interface BatchCookSheetProps {
  open: boolean;
  onClose: () => void;
}

/** ENG-1242 — batch cook scale + portion planner (MVP shell, flag-gated). */
export function BatchCookSheet({ open, onClose }: BatchCookSheetProps) {
  if (!open || !isFeatureEnabled("batch_cook_planner_v1")) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-label="Batch cook"
        className="w-full max-w-lg rounded-t-2xl border bg-card p-6 shadow-xl"
      >
        <h2 className="text-lg font-semibold text-foreground">Batch cook</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Cook once, then assign portions across your plan days. Full planner wiring
          lands in a follow-up once the sheet UX is validated.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Close
        </button>
      </div>
    </div>
  );
}

export function BatchCookPlanToolRow({ onOpen }: { onOpen: () => void }) {
  if (!isFeatureEnabled("batch_cook_planner_v1")) return null;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Batch cook"
      className="mt-3 flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-[background-color,transform] hover:bg-[var(--background-secondary)] active:scale-[0.99]"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >
      <span
        className="flex size-11 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: "var(--accent-primary-soft)" }}
      >
        <ChefHat className="size-[18px]" strokeWidth={1.9} style={{ color: "var(--primary)" }} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-foreground">Batch cook</span>
        <span className="mt-px block text-[11px] text-foreground-tertiary">
          Scale a recipe and assign portions
        </span>
      </span>
      <ChevronRight className="size-[18px] shrink-0 text-foreground-tertiary" />
    </button>
  );
}
