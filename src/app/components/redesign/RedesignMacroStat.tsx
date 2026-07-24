"use client";

/**
 * RedesignMacroStat — a single macro readout (protein / carbs / fat / …).
 *
 * Refresh direction: the value is the hero (serif, brand ink), the label is a
 * quiet uppercase eyebrow, and the progress track is a slim tinted rail in the
 * macro's own hue. Used both in the compact hero legend and the macro grid.
 */

type RedesignMacroStatProps = {
  label: string;
  value: number;
  goal: number;
  unit?: string;
  /** Any color string / CSS var for the fill + tint. */
  color: string;
  /** Compact = hero legend (no card chrome); default = grid tile. */
  variant?: "tile" | "compact";
};

const serif: React.CSSProperties = { fontFamily: "var(--font-display)" };

export function RedesignMacroStat({
  label,
  value,
  goal,
  unit = "g",
  color,
  variant = "tile",
}: RedesignMacroStatProps) {
  const pct = goal > 0 ? Math.min(value / goal, 1) : 0;
  const left = Math.max(goal - value, 0);

  return (
    <div
      className={
        variant === "tile"
          ? "flex flex-col gap-2 rounded-[var(--radius-card-lg)] bg-card card-slab p-4"
          : "flex flex-col gap-1"
      }
    >
      <div className="flex items-center gap-1">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden
        />
        <span
          className="text-[11px] uppercase tracking-[0.12em] font-medium"
          style={{ color: "var(--foreground-tertiary)" }}
        >
          {label}
        </span>
      </div>

      <div className="flex items-baseline gap-1">
        <span
          className="leading-none tabular-nums"
          style={{ ...serif, fontSize: "1.5rem", color: "var(--foreground-brand)" }}
        >
          {value}
        </span>
        <span className="text-[13px] tabular-nums" style={{ color: "var(--foreground-tertiary)" }}>
          / {goal}
          {unit}
        </span>
      </div>

      <div
        className="h-1.5 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: "var(--background-secondary)" }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct * 100}%`,
            backgroundColor: color,
            transition: "width 700ms var(--ease-spring-soft)",
          }}
        />
      </div>

      {variant === "tile" && (
        <span className="text-[11px]" style={{ color: "var(--foreground-tertiary)" }}>
          {left}
          {unit} left
        </span>
      )}
    </div>
  );
}
