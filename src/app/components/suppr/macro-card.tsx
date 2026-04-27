"use client";

import * as React from "react";
import { cn } from "../ui/utils";
import { IconBox } from "../ui/icon-box";
import { Icons, type IconName } from "../ui/icons";
import { formatMacro } from "../../../lib/nutrition/formatMacro";

/**
 * MacroCard — colour-coded macro nutrient display.
 *
 * Shows a macro value with its icon, label, and optional
 * target progress bar. Used on the Today screen, recipe
 * detail, and meal plan views.
 */

type MacroType = "protein" | "carbs" | "fat" | "calories";

const macroConfig: Record<
  MacroType,
  { icon: IconName; tone: "protein" | "carbs" | "fat" | "success"; label: string }
> = {
  protein: { icon: "protein", tone: "protein", label: "Protein" },
  carbs: { icon: "carbs", tone: "carbs", label: "Carbs" },
  fat: { icon: "fat", tone: "fat", label: "Fat" },
  calories: { icon: "calories", tone: "success", label: "Calories" },
};

interface MacroCardProps extends React.ComponentProps<"div"> {
  macro: MacroType;
  value: number;
  target?: number;
  unit?: string;
  compact?: boolean;
}

function MacroCard({
  macro,
  value,
  target,
  unit = "g",
  compact = false,
  className,
  ...props
}: MacroCardProps) {
  const config = macroConfig[macro];
  const Icon = Icons[config.icon];
  const pct = target ? Math.min((value / target) * 100, 100) : 0;
  const displayUnit = macro === "calories" ? "kcal" : unit;

  // CSS variable colour for the progress bar
  const barColor =
    macro === "calories"
      ? "var(--macro-calories)"
      : `var(--macro-${macro})`;

  if (compact) {
    return (
      <div
        className={cn("flex items-center gap-1.5", className)}
        {...props}
      >
        <Icon className="size-3.5" style={{ color: barColor }} />
        <span className="tabular-nums text-sm font-semibold">
          {formatMacro(value, macro)}
        </span>
        <span className="text-xs text-muted-foreground">{displayUnit}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex-1 flex flex-col rounded-card bg-card p-2.5 border border-border",
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-1 mb-1">
        <div
          className="w-2 h-2 rounded-sm"
          style={{ background: barColor }}
        />
        <span className="text-[10px] font-semibold text-muted-foreground tracking-wider uppercase">
          {config.label}
        </span>
      </div>

      <div className="tabular-nums text-base font-bold text-foreground leading-none mb-1">
        {formatMacro(value, macro)}{displayUnit}
      </div>

      {target && (
        <div className="h-1 w-full overflow-hidden rounded-sm bg-muted">
          <div
            className="h-full rounded-sm transition-all duration-700"
            style={{
              width: `${pct}%`,
              backgroundColor: barColor,
            }}
          />
        </div>
      )}

      {target && (
        <div className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
          of {Math.round(target)}{displayUnit}
        </div>
      )}
    </div>
  );
}

export { MacroCard, type MacroType };
