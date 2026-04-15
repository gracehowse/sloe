import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../ui/utils";
import { Icons } from "../ui/icons";

/**
 * FitBadge — shows how well a recipe fits the user's remaining macros.
 *
 * "Great Fit", "Good Fit", "Over Budget" — colour-coded with icon.
 * Used on recipe cards in the discover feed and search results.
 */

const fitBadgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold leading-none",
  {
    variants: {
      fit: {
        great: "bg-success-soft text-success",
        good: "bg-warning-soft text-warning",
        over: "bg-destructive/10 text-destructive",
      },
    },
    defaultVariants: {
      fit: "great",
    },
  },
);

type FitLevel = "great" | "good" | "over";

const fitConfig: Record<FitLevel, { icon: typeof Icons.check; label: string }> = {
  great: { icon: Icons.check, label: "Great Fit" },
  good: { icon: Icons.target, label: "Good Fit" },
  over: { icon: Icons.alert, label: "Over Budget" },
};

interface FitBadgeProps
  extends React.ComponentProps<"span">,
    VariantProps<typeof fitBadgeVariants> {
  fit: FitLevel;
}

function FitBadge({ fit, className, ...props }: FitBadgeProps) {
  const config = fitConfig[fit];
  const Icon = config.icon;

  return (
    <span
      data-slot="fit-badge"
      className={cn(fitBadgeVariants({ fit }), className)}
      {...props}
    >
      <Icon className="size-3" />
      {config.label}
    </span>
  );
}

export { FitBadge, type FitLevel };
