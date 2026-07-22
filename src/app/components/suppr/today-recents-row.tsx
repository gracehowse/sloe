"use client";

import * as React from "react";
import { Camera, Clock, Plus, ScanBarcode, Sparkles, type LucideIcon } from "lucide-react";

import { isFeatureEnabled } from "../../../lib/analytics/track.ts";
import type { FoodHistoryItem } from "../../../lib/nutrition/foodHistory";

/** Source → chip glyph (prototype `srcChip` map). Plain recents use the clock. */
function sourceIcon(source?: string): LucideIcon {
  const s = (source ?? "").toLowerCase();
  if (s.includes("barcode") || s.includes("scan")) return ScanBarcode;
  if (s.includes("photo") || s.includes("image") || s.includes("camera")) return Camera;
  if (s.includes("ai") || s.includes("voice") || s.includes("gpt")) return Sparkles;
  return Clock;
}

export interface TodayRecentsRowProps {
  recents: FoodHistoryItem[];
  /** One-tap re-log a recent food into the active slot. */
  onReLog: (item: FoodHistoryItem) => void;
  /** "All" link + empty-state prompt → open the full LogSheet. */
  onOpenAll: () => void;
}

/**
 * Today "Quick add" recents row — web twin of mobile `TodayRecentsRow`
 * (ENG-1247, v3 prototype `.quickrow`). One-tap re-log chips of the user's
 * most-recent foods (the daily loop is mostly repeat eating). The
 * method-launchers (Search/Voice/Snap/Scan) live in the LogSheet, reached via
 * the "All" link. Flag-gated by the host (`today_quickadd_recents_v3`).
 */
export function TodayRecentsRow({ recents, onReLog, onOpenAll }: TodayRecentsRowProps) {
  const items = recents.slice(0, 6);
  // type_scale_v1 (visible-resize, ENG font-consistency sweep): 18px → 24px
  // + brand ink; off = legacy 18px foreground (kill switch).
  const typeScaleV1 = isFeatureEnabled("type_scale_v1");
  return (
    <div className="mt-5">
      <div className="mb-2 flex items-center justify-between">
        <h2
          className={
            typeScaleV1
              ? "font-[family-name:var(--font-headline)] text-2xl font-medium text-foreground-brand"
              : "font-[family-name:var(--font-headline)] text-[18px] text-foreground"
          }
        >
          Quick add
        </h2>
        <button
          type="button"
          onClick={onOpenAll}
          aria-label="All logging options"
          className="text-[13px] font-semibold text-primary-solid transition-opacity hover:opacity-80"
        >
          All
        </button>
      </div>
      {items.length === 0 ? (
        <button
          type="button"
          data-testid="today-recents-empty"
          onClick={onOpenAll}
          className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-border text-foreground-secondary transition-colors hover:bg-muted/40"
        >
          <Plus className="h-4 w-4" />
          <span className="text-sm">Log your first meal</span>
        </button>
      ) : (
        <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((item, i) => {
            const Icon = sourceIcon(item.source);
            const name =
              item.recipeTitle.length > 15 ? `${item.recipeTitle.slice(0, 15)}…` : item.recipeTitle;
            return (
              <button
                key={`${item.recipeTitle}-${i}`}
                type="button"
                data-testid={`today-recent-chip-${i}`}
                onClick={() => onReLog(item)}
                aria-label={`Log ${item.recipeTitle}, ${Math.round(item.calories)} calories`}
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-background-secondary px-3 transition-opacity hover:opacity-90"
              >
                <Icon className="h-3.5 w-3.5 text-foreground-tertiary" />
                <span className="whitespace-nowrap text-xs text-foreground">{name}</span>
                <span className="text-xs font-bold tabular-nums text-foreground">
                  {Math.round(item.calories)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
