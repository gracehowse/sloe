"use client";

import * as React from "react";
import { Sparkles, Flame, Utensils, Scale } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  MILESTONE_30_DAY_THRESHOLD,
  type Milestone30DayContent,
} from "../../../lib/nutrition/milestone30Day";

/**
 * Milestone30DayDialog — web parity for the mobile Milestone30DayModal
 * (PR claude/today-30-day-milestone, 2026-05-02).
 *
 * Pure trust moment surfaced once when the user crosses 30 distinct
 * logged days. Single CTA: "Keep going". No paywall, no upsell.
 */
export interface Milestone30DayDialogProps {
  open: boolean;
  /** `null` is a programming error — only mount when content is built. */
  content: Milestone30DayContent | null;
  onDismiss: () => void;
}

export function Milestone30DayDialog({
  open,
  content,
  onDismiss,
}: Milestone30DayDialogProps) {
  if (!content) return null;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onDismiss();
      }}
    >
      <DialogContent className="bg-card border-border max-w-sm">
        <div className="flex flex-col items-center pt-2 pb-1">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-3"
            style={{ background: "var(--primary-soft)" }}
          >
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <DialogHeader>
            <DialogTitle
              className="text-2xl font-extrabold text-center"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {content.headline}
            </DialogTitle>
            <DialogDescription className="text-sm text-center text-muted-foreground px-2 mt-1">
              You crossed {MILESTONE_30_DAY_THRESHOLD}+ distinct days with meals
              logged — here&apos;s a snapshot (averages, favourites, and your best
              consecutive run).
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-2 mt-3">
          <StatTile
            icon={<Flame className="w-4 h-4 text-primary" />}
            label="Avg daily kcal"
            value={content.avgDailyKcal.toLocaleString("en-GB")}
          />
          <StatTile
            icon={<Sparkles className="w-4 h-4 text-primary" />}
            label="Best run"
            value={`${content.longestStreak} day${content.longestStreak === 1 ? "" : "s"}`}
          />
        </div>

        {/* Top foods */}
        {content.topFoods.length > 0 ? (
          <div className="rounded-xl border border-border px-4 py-3 mt-3">
            <div className="flex items-center mb-2">
              <Utensils className="w-4 h-4 text-primary" />
              <span className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground ml-2">
                Most-logged foods
              </span>
            </div>
            <ul className="space-y-1.5">
              {content.topFoods.map((food, idx) => (
                <li
                  key={`${food.name}-${idx}`}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="truncate text-foreground mr-2">
                    {idx + 1}. {food.name}
                  </span>
                  <span
                    className="text-muted-foreground font-semibold text-xs shrink-0"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {food.count}×
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Weight delta — suppressed when null */}
        {content.totalWeightDeltaKg != null ? (
          <div className="flex items-center rounded-xl border border-border px-4 py-3 mt-3">
            <Scale className="w-4 h-4 text-primary" />
            <span className="text-sm text-muted-foreground ml-2 flex-1">
              Weight (first→last log day)
            </span>
            <span
              className="text-sm font-bold text-foreground"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {formatSignedKg(content.totalWeightDeltaKg)}
            </span>
          </div>
        ) : null}

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Keep going"
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity mt-4"
        >
          Keep going
        </button>
      </DialogContent>
    </Dialog>
  );
}

function StatTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border px-3 py-3">
      <div className="flex items-center mb-1.5">
        {icon}
        <span className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground ml-1.5 truncate">
          {label}
        </span>
      </div>
      <p
        className="text-lg font-extrabold text-foreground truncate"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </p>
    </div>
  );
}

function formatSignedKg(n: number): string {
  if (n === 0) return "0.0 kg";
  const sign = n > 0 ? "+" : "−";
  return `${sign}${Math.abs(n).toFixed(1)} kg`;
}

export default Milestone30DayDialog;
