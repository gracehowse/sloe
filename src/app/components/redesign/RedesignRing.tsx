"use client";

/**
 * RedesignRing — refresh-direction calorie ring.
 *
 * Evolution of the existing DailyRing: a calmer single-sweep arc on a
 * whisper track, rounded caps, and an editorial serif numeral stack in the
 * middle (remaining kcal). The sweep uses the Sloe plum→clay brand gradient
 * so the hero reads as brand, not utility. Purely presentational + mock-safe.
 */

type RedesignRingProps = {
  consumed: number;
  goal: number;
  size?: number;
  strokeWidth?: number;
};

const serif: React.CSSProperties = { fontFamily: "var(--font-display)" };

export function RedesignRing({
  consumed,
  goal,
  size = 208,
  strokeWidth = 16,
}: RedesignRingProps) {
  const remaining = Math.max(goal - consumed, 0);
  const pct = goal > 0 ? Math.min(consumed / goal, 1) : 0;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * pct;
  const center = size / 2;

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${consumed} of ${goal} calories consumed, ${remaining} remaining`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="redesign-ring-sweep" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--accent-primary)" />
            <stop offset="55%" stopColor="var(--accent-primary-lift)" />
            <stop offset="100%" stopColor="var(--accent-clay)" />
          </linearGradient>
        </defs>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--background-secondary)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="url(#redesign-ring-sweep)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          style={{ transition: "stroke-dasharray 700ms var(--ease-spring-soft)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0">
        <span
          className="text-[11px] uppercase tracking-[0.14em] font-medium"
          style={{ color: "var(--foreground-tertiary)" }}
        >
          Remaining
        </span>
        <span
          className="leading-none tabular-nums"
          style={{ ...serif, fontSize: "2.75rem", color: "var(--foreground-brand)" }}
        >
          {remaining.toLocaleString()}
        </span>
        <span className="text-[13px]" style={{ color: "var(--foreground-secondary)" }}>
          <span className="tabular-nums">{consumed.toLocaleString()}</span> of{" "}
          <span className="tabular-nums">{goal.toLocaleString()}</span> kcal
        </span>
      </div>
    </div>
  );
}
