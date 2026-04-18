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
    <div className="flex gap-2 mb-5">
      {/* Search chip */}
      <button
        type="button"
        onClick={onOpenSearch}
        className="flex-1 flex-col items-center gap-1.5 p-2.5 rounded-xl bg-card border border-border hover:border-warning/40 transition-colors flex"
      >
        <IconBox size="sm" tone="warning">
          <Icons.search />
        </IconBox>
        <span className="text-[10px] font-medium text-muted-foreground">Search</span>
      </button>

      {/* Voice chip (Pro) */}
      <button
        type="button"
        onClick={onOpenVoiceLog}
        aria-label={userTier === "pro" ? "Open voice log" : "Voice log — Pro feature"}
        className="flex-1 flex-col items-center gap-1.5 p-2.5 rounded-xl bg-card border border-border hover:border-success/40 transition-colors flex relative"
      >
        <IconBox size="sm" tone="success">
          <Icons.mic />
        </IconBox>
        <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
          Voice
          {proLocked && <Icons.lock className="size-2.5" aria-hidden />}
        </span>
      </button>

      {/* Snap chip (Pro — AI photo logging) */}
      <button
        type="button"
        onClick={onOpenPhotoLog}
        aria-label={userTier === "pro" ? "Open AI photo log" : "AI photo log — Pro feature"}
        className="flex-1 flex-col items-center gap-1.5 p-2.5 rounded-xl bg-card border border-border hover:border-primary/40 transition-colors flex relative"
      >
        <IconBox size="sm" tone="primary">
          <Icons.camera />
        </IconBox>
        <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
          Snap
          {proLocked && <Icons.lock className="size-2.5" aria-hidden />}
        </span>
      </button>

      {/* Scan chip */}
      <button
        type="button"
        onClick={onOpenBarcode}
        className="flex-1 flex-col items-center gap-1.5 p-2.5 rounded-xl bg-card border border-border hover:border-fat/40 transition-colors flex"
      >
        <IconBox size="sm" tone="fat">
          <Icons.scan />
        </IconBox>
        <span className="text-[10px] font-medium text-muted-foreground">Scan</span>
      </button>
    </div>
  );
}
