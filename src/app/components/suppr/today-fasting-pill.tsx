"use client";

import * as React from "react";
import Link from "next/link";
import { Icons } from "../ui/icons";

/**
 * TodayFastingPill — small CTA linking to /fasting.
 *
 * Extracted from `NutritionTracker.tsx` (audit H3, 2026-04-18). Host
 * computes whether a fast is active and the elapsed label; the pill only
 * renders.
 */
export interface TodayFastingPillProps {
  activeFastElapsedLabel: string | null;
}

export function TodayFastingPill({ activeFastElapsedLabel }: TodayFastingPillProps) {
  return (
    <div className="mt-4 flex flex-col items-center gap-2">
      {activeFastElapsedLabel ? (
        <Link
          href="/fasting"
          className="inline-flex flex-row items-center justify-center gap-2 py-2 px-4 rounded-lg font-bold text-sm text-primary bg-primary/10 border border-primary/20 hover:bg-primary/15 transition-colors"
        >
          <Icons.timer className="w-4 h-4 shrink-0" aria-hidden />
          Fasting — {activeFastElapsedLabel}
        </Link>
      ) : (
        <Link href="/fasting" className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors">
          Intermittent fasting timer
        </Link>
      )}
    </div>
  );
}
