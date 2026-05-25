"use client";

import { SupprPlateMark } from "../ui/suppr-mark";
import { cn } from "../ui/utils";

/**
 * Reserved branding row at the top of Today — plate mark only (sans
 * wordmark; "Today" is the page headline). Hidden on desktop when the
 * sidebar already carries the brand.
 */
export function TodayBrandBar({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex items-center min-h-[28px] lg:hidden", className)}
      data-testid="today-brand-bar"
    >
      <SupprPlateMark size={24} />
    </div>
  );
}
