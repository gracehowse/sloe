"use client";

/**
 * TodayLoadingSkeleton — ENG-889 L1 / Figma `326:2` loading frame.
 *
 * Mirrors the loaded Today day-view layout (greeting → week strip → hero
 * card with ring → macro grid → meal rows) so dynamic-import and journal
 * hydration reads as "Today is loading" rather than a generic full-screen
 * pulse. Parity with mobile `index.tsx` `!hydrated` shimmer branch.
 */

import { SupprCard } from "../ui/suppr-card.tsx";
import { cn } from "../ui/utils.ts";

function Shimmer({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "block animate-pulse rounded-md bg-muted [animation-duration:700ms]",
        className,
      )}
    />
  );
}

export function TodayLoadingSkeleton() {
  return (
    <div
      className="product-shell py-pm-5 space-y-4"
      data-testid="today-loading-skeleton"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading Today</span>

      {/* Greeting + date — matches compact `today-hero-greeting` row */}
      <Shimmer className="mt-1 h-4 w-56 max-w-[85%] rounded-sm" />

      {/* Week strip — seven day cells */}
      <div className="flex justify-between gap-1.5" aria-hidden>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
            <Shimmer className="h-2.5 w-6 rounded-sm" />
            <Shimmer className="h-8 w-8 rounded-full" />
          </div>
        ))}
      </div>

      {/* Hero card — chip row + ring + Goal/Eaten/Bonus row */}
      <SupprCard padding="lg" radius="lg" className="flex flex-col items-center">
        <div className="mb-4 flex w-full items-center justify-between gap-3">
          <Shimmer className="h-4 w-24 rounded-full" />
          <Shimmer className="h-6 w-28 rounded-full" />
        </div>
        <Shimmer className="h-[160px] w-[160px] rounded-full" />
        <div className="mt-5 flex w-full gap-3 border-t border-border pt-5">
          <Shimmer className="h-10 flex-1 rounded-xl" />
          <Shimmer className="h-10 flex-1 rounded-xl" />
          <Shimmer className="h-10 flex-1 rounded-xl" />
        </div>
      </SupprCard>

      {/* Macro tile grid */}
      <div className="grid grid-cols-2 gap-3" aria-hidden>
        {Array.from({ length: 4 }).map((_, i) => (
          <SupprCard key={i} padding="md" radius="lg" className="min-h-[80px]">
            <Shimmer className="mb-2 h-3 w-16 rounded-sm" />
            <Shimmer className="h-5 w-20 rounded-sm" />
          </SupprCard>
        ))}
      </div>

      {/* Meal log rows */}
      <div className="space-y-3" aria-hidden>
        <Shimmer className="h-16 w-full rounded-[var(--radius-card)]" />
        <Shimmer className="h-16 w-full rounded-[var(--radius-card)]" />
      </div>
    </div>
  );
}
