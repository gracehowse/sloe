"use client";

/**
 * SkeletonRow + SkeletonCard — silhouettes that match real component
 * shapes with a 700ms shimmer animation.
 *
 * Production design spec — 2026-04-27 §Part 3 "New components".
 * Replaces ad-hoc `<Skeleton>` chains; one place to change the shimmer
 * curve + duration. Reduce-motion fallback comes from the global CSS
 * rule in `theme.css` which neutralises `animation-duration`.
 *
 * Mirror: `apps/mobile/components/ui/SkeletonRow.tsx` (same shape).
 *
 * Phase 1 ships the primitive only. Loading states across the app are
 * NOT migrated here.
 */

import * as React from "react";
import { cn } from "./utils";

export interface SkeletonRowProps extends React.ComponentProps<"div"> {
  /** Number of secondary text lines to render. Defaults to 1. */
  lines?: 1 | 2;
  /** Whether to render a leading thumb silhouette. Defaults to true. */
  thumb?: boolean;
}

/**
 * Single row silhouette — thumb + 1-2 text lines. Matches the shape of
 * meal cards, recipe rows, and search-result rows.
 */
export function SkeletonRow({
  lines = 2,
  thumb = true,
  className,
  ...props
}: SkeletonRowProps) {
  return (
    <div
      data-slot="skeleton-row"
      aria-busy="true"
      aria-live="polite"
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border bg-card p-3",
        className,
      )}
      {...props}
    >
      {thumb ? <Shimmer className="size-10 shrink-0 rounded-md" /> : null}
      <div className="flex flex-1 flex-col gap-1.5">
        <Shimmer className="h-3.5 w-3/5 rounded-sm" />
        {lines >= 2 ? <Shimmer className="h-3 w-2/5 rounded-sm" /> : null}
      </div>
    </div>
  );
}

export interface SkeletonCardProps extends React.ComponentProps<"div"> {
  /** Render a hero image area at the top. Defaults to true. */
  hero?: boolean;
  /** Number of body text lines. Defaults to 2. */
  lines?: 1 | 2 | 3;
}

/**
 * Recipe-card / Today-card silhouette — hero area + 1-3 text lines.
 */
export function SkeletonCard({
  hero = true,
  lines = 2,
  className,
  ...props
}: SkeletonCardProps) {
  return (
    <div
      data-slot="skeleton-card"
      aria-busy="true"
      aria-live="polite"
      className={cn(
        "flex flex-col gap-3 overflow-hidden rounded-[var(--radius-card)] border border-border bg-card",
        className,
      )}
      {...props}
    >
      {hero ? <Shimmer className="aspect-[16/10] w-full rounded-none" /> : null}
      <div className="flex flex-col gap-2 px-4 pb-4">
        <Shimmer className="h-4 w-3/4 rounded-sm" />
        {Array.from({ length: lines - 1 }).map((_, i) => (
          <Shimmer
            key={i}
            className="h-3 rounded-sm"
            style={{ width: `${50 + i * 12}%` }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Internal shimmer pulse — 700ms infinite. Honours
 * `prefers-reduced-motion: reduce` via the global rule in
 * `theme.css`.
 */
function Shimmer({
  className,
  style,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden
      className={cn(
        "block animate-pulse bg-muted",
        // Fixed 700ms duration per spec. Tailwind's animate-pulse is
        // 2s — override here.
        "[animation-duration:700ms]",
        className,
      )}
      style={style}
      {...props}
    />
  );
}

export default SkeletonRow;
