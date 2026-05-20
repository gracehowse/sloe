"use client";

import { SupprPlateWordmark } from "../ui/suppr-mark";
import { cn } from "../ui/utils";

/**
 * Reserved branding row at the top of Today — plate mark + working
 * name "Suppr" until rebrand. Hidden on desktop when the sidebar
 * already carries the brand.
 */
export function TodayBrandBar({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex items-center min-h-[44px] pb-1 lg:hidden", className)}
      data-testid="today-brand-bar"
    >
      <SupprPlateWordmark size={26} />
    </div>
  );
}
