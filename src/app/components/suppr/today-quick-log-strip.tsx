"use client";

import * as React from "react";
import { Icons } from "../ui/icons";
import { IconBox } from "../ui/icon-box";
import type { UserTier } from "../../../types/recipe";

/**
 * TodayQuickLogStrip — Search / Voice / Snap / Scan chips.
 *
 * Extracted from `NutritionTracker.tsx` (audit H3, 2026-04-18). Voice +
 * Snap are Pro-gated (Batch 5.13); the paywall/dialog-open decision
 * stays in the host so analytics firing points remain unchanged.
 *
 * 2026-05-01 — ui-critic finding #1 (P0). Lifted to a 56px tile +
 * `IconBox size="md"` (36px tinted square / 16px lucide glyph) + 12px
 * label. The redundant outer `border` was dropped — the tinted icon
 * box carries the colour identity. Mirrors the mobile sizing in
 * `apps/mobile/components/today/TodayQuickLogStrip.tsx` so the chip
 * row reads as the primary log affordance on both platforms.
 */
export interface TodayQuickLogStripProps {
  userTier: UserTier;
  onOpenSearch: () => void;
  onOpenVoiceLog: () => void;
  onOpenPhotoLog: () => void;
  onOpenBarcode: () => void;
}

export function TodayQuickLogStrip({
  userTier,
  onOpenSearch,
  onOpenVoiceLog,
  onOpenPhotoLog,
  onOpenBarcode,
}: TodayQuickLogStripProps) {
  const proLocked = userTier !== "pro";
  return (
    <div className="flex gap-2 mt-3 mb-4">
      {/* Search chip */}
      <button
        type="button"
        onClick={onOpenSearch}
        className="flex-1 min-h-14 flex-col items-center justify-center gap-1.5 px-1 py-2 rounded-xl bg-card hover:bg-card/80 transition-colors flex"
      >
        <IconBox size="md" tone="warning">
          <Icons.search />
        </IconBox>
        <span className="text-xs font-medium text-muted-foreground tabular-nums">Search</span>
      </button>

      {/* Voice chip (Pro) */}
      <button
        type="button"
        onClick={onOpenVoiceLog}
        aria-label={userTier === "pro" ? "Open voice log" : "Voice log — Pro feature"}
        className="flex-1 min-h-14 flex-col items-center justify-center gap-1.5 px-1 py-2 rounded-xl bg-card hover:bg-card/80 transition-colors flex relative"
      >
        <IconBox size="md" tone="success">
          <Icons.mic />
        </IconBox>
        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1 tabular-nums">
          Voice
          {proLocked && <Icons.lock className="size-2.5" aria-hidden />}
        </span>
      </button>

      {/* Snap chip (Pro — AI photo logging) */}
      <button
        type="button"
        onClick={onOpenPhotoLog}
        aria-label={userTier === "pro" ? "Open AI photo log" : "AI photo log — Pro feature"}
        className="flex-1 min-h-14 flex-col items-center justify-center gap-1.5 px-1 py-2 rounded-xl bg-card hover:bg-card/80 transition-colors flex relative"
      >
        <IconBox size="md" tone="primary">
          <Icons.camera />
        </IconBox>
        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1 tabular-nums">
          Snap
          {proLocked && <Icons.lock className="size-2.5" aria-hidden />}
        </span>
      </button>

      {/* Scan chip */}
      <button
        type="button"
        onClick={onOpenBarcode}
        className="flex-1 min-h-14 flex-col items-center justify-center gap-1.5 px-1 py-2 rounded-xl bg-card hover:bg-card/80 transition-colors flex"
      >
        <IconBox size="md" tone="fat">
          <Icons.scan />
        </IconBox>
        <span className="text-xs font-medium text-muted-foreground tabular-nums">Scan</span>
      </button>
    </div>
  );
}
