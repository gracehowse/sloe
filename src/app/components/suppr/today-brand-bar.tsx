"use client";

import { SupprWordmark } from "../ui/suppr-mark";
import { cn } from "../ui/utils";

/**
 * Reserved branding row at the top of Today — Sloe wordmark only.
 * Hidden on desktop when the sidebar already carries the brand.
 */
export function TodayBrandBar({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex items-center min-h-[28px] lg:hidden", className)}
      data-testid="today-brand-bar"
    >
      {/* size 28 → 20px wordmark (`text-xl`), matching Figma `654:2`. */}
      <SupprWordmark size={28} />
    </div>
  );
}
