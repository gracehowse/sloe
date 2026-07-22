"use client";

import * as React from "react";
import { cn } from "./utils";

export interface CountBadgeProps extends React.ComponentProps<"span"> {
  count: number;
  active?: boolean;
}

export function formatCountBadge(count: number): string {
  return count > 999 ? "999+" : String(count);
}

export function CountBadge({ count, active = false, className, ...props }: CountBadgeProps) {
  if (count <= 0) return null;
  return (
    <span
      data-slot="count-badge"
      className={cn(
        "inline-flex h-[18px] min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold",
        active ? "bg-foreground text-primary-foreground" : "bg-border text-muted-foreground",
        className,
      )}
      {...props}
    >
      {formatCountBadge(count)}
    </span>
  );
}

export default CountBadge;
