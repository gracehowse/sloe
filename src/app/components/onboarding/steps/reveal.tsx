"use client";

import * as React from "react";
import { useOnboarding } from "../context";
import { MethodologyNote } from "../scaffold";

/**
 * Reveal — step 11. The "aha" moment. Animated count-up on the daily
 * target + per-macro tiles + BMR / TDEE summary.
 *
 * Renders a quieter "answer the body-stat steps to see your numbers"
 * fallback when targets are null (e.g. user jumped here via the
 * dev-preview tweaks panel without entering body data). In production
 * the validation in `canAdvance` ensures targets is non-null by the
 * time we land here.
 */

interface RevealProps {
  /** Mobile uses tighter padding to fit the iPhone safe area. */
  compact?: boolean;
}

export function RevealStep({ compact = false }: RevealProps) {
  const { targets, state } = useOnboarding();

  // Animated count-up — easeOutCubic over ~1.2s.
  const [displayCals, setDisplayCals] = React.useState(0);
  const [ringProgress, setRingProgress] = React.useState(0);
  const target = targets?.target ?? 0;
  React.useEffect(() => {
    if (target === 0) {
      setDisplayCals(0);
      setRingProgress(0);
      return;
    }
    const start = performance.now();
    const dur = 1200;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setDisplayCals(Math.round(target * e));
      setRingProgress(e);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  if (targets == null) {
    // Diversity-inclusion Stage F — when the user opted out of
    // entering a weight, show a calibrate-from-logs message instead
    // of the body-stats prompt. Same null-targets branch otherwise
    // catches mid-flow tweaks (e.g. design preview deep-links).
    const calibrateCopy = state.weightSkipped
      ? "Your targets will calibrate from your meal logs over the first couple of weeks. You can add a weight any time from Settings."
      : "Answer the body-stats steps to see your daily targets.";
    return (
      <div className="h-full grid place-items-center px-6 text-center">
        <p className="text-muted-foreground text-sm max-w-[320px] leading-relaxed">
          {calibrateCopy}
        </p>
      </div>
    );
  }

  const userPace = targets.pace;
  const kcalAdj = Math.abs(targets.kcalAdj);
  const paceLabel = userPace.toFixed(userPace < 0.1 ? 2 : 2);
  const goalBlurb = {
    lose: `At ~${paceLabel} kg/week, this is ~${kcalAdj.toLocaleString()} kcal below your estimated TDEE of ${targets.tdee.toLocaleString()}.`,
    maintain: `This matches your estimated TDEE of ${targets.tdee.toLocaleString()} — no deficit, no surplus.`,
    gain: `A ~${kcalAdj.toLocaleString()} kcal surplus on your estimated TDEE of ${targets.tdee.toLocaleString()} for ~${paceLabel} kg/week gains. Slow builds hold.`,
    recomp: `A ~${kcalAdj.toLocaleString()} kcal deficit with protein anchored to bodyweight. Body composition changes take time.`,
  }[state.goal ?? "maintain"];

  // Ring geometry
  const R = 88;
  const C = 2 * Math.PI * R;
  const dash = C * ringProgress;

  return (
    <div
      className="h-full overflow-auto"
      style={{
        background:
          "linear-gradient(180deg, color-mix(in oklab, var(--primary) 12%, transparent) 0%, color-mix(in oklab, var(--macro-fat) 4%, transparent) 40%, transparent 70%)",
      }}
    >
      {/* Hero */}
      <div className={compact ? "px-5 pt-6 pb-4 text-center" : "px-8 pt-8 pb-5 text-center"}>
        <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary mb-2.5">
          Your daily target
        </div>
        <h1
          className={`font-bold tracking-tight m-0 mb-5 text-foreground leading-tight ${compact ? "text-xl" : "text-[22px]"}`}
          style={{ letterSpacing: "-0.02em", textWrap: "balance" } as React.CSSProperties}
        >
          Here&apos;s what your day looks like.
        </h1>

        <div
          className="relative mx-auto"
          style={{ width: compact ? 210 : 240, height: compact ? 210 : 240 }}
        >
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 220 220"
            style={{ transform: "rotate(-90deg)" }}
          >
            <defs>
              <linearGradient id="reveal-grad" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" />
                <stop offset="100%" stopColor="var(--macro-fat)" />
              </linearGradient>
            </defs>
            <circle
              cx={110}
              cy={110}
              r={R}
              stroke="var(--input-background)"
              strokeWidth={12}
              fill="none"
            />
            <circle
              cx={110}
              cy={110}
              r={R}
              stroke="url(#reveal-grad)"
              strokeWidth={12}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C - dash}
              style={{ transition: "stroke-dashoffset 80ms linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col justify-center items-center">
            <div
              className="font-extrabold tracking-tight tabular-nums leading-none text-foreground"
              style={{
                fontSize: compact ? 52 : 60,
                letterSpacing: "-0.035em",
              }}
            >
              {displayCals.toLocaleString()}
            </div>
            <div className="text-xs font-semibold text-muted-foreground mt-1.5 tracking-tight">
              kcal / day
            </div>
          </div>
        </div>

        <p
          className="text-sm text-muted-foreground mx-auto mt-4 leading-relaxed max-w-[340px]"
          style={{ textWrap: "pretty" } as React.CSSProperties}
        >
          {goalBlurb}
        </p>
      </div>

      {/* Macro breakdown + BMR/TDEE summary */}
      <div className={compact ? "px-5 pb-7" : "px-8 pb-8"}>
        <div className="grid grid-cols-3 gap-2.5 mb-3.5">
          <MacroTile
            name="Protein"
            value={targets.proteinG}
            color="var(--primary)"
            pct={Math.round(((targets.proteinG * 4) / targets.target) * 100)}
          />
          <MacroTile
            name="Carbs"
            value={targets.carbsG}
            color="var(--warning)"
            pct={Math.round(((targets.carbsG * 4) / targets.target) * 100)}
          />
          <MacroTile
            name="Fat"
            value={targets.fatG}
            color="var(--macro-fat)"
            pct={Math.round(((targets.fatG * 9) / targets.target) * 100)}
          />
        </div>

        <div className="bg-card border border-border rounded-xl p-3.5 grid grid-cols-2 gap-3">
          <div>
            <div className="section-label">BMR</div>
            <div className="text-lg font-bold tabular-nums text-foreground tracking-tight mt-0.5">
              {targets.bmr.toLocaleString()}
              <span className="text-[11px] text-muted-foreground font-medium ml-1">
                kcal
              </span>
            </div>
          </div>
          <div>
            <div className="section-label">Est. TDEE</div>
            <div className="text-lg font-bold tabular-nums text-foreground tracking-tight mt-0.5">
              {targets.tdee.toLocaleString()}
              <span className="text-[11px] text-muted-foreground font-medium ml-1">
                kcal
              </span>
            </div>
          </div>
        </div>

        <MethodologyNote>
          Values are estimates based on the Mifflin-St Jeor equation. Suppr
          will re-calibrate your TDEE from your logged intake and activity
          data over the first ~2 weeks.
        </MethodologyNote>
      </div>
    </div>
  );
}

function MacroTile({
  name,
  value,
  color,
  pct,
}: {
  name: string;
  value: number;
  color: string;
  pct: number;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-3.5">
      <div className="flex justify-between items-center mb-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {name}
        </span>
        <span
          className="text-[10px] font-bold tabular-nums"
          style={{ color }}
        >
          {pct}%
        </span>
      </div>
      <div
        className="text-[22px] font-extrabold tabular-nums leading-none text-foreground tracking-tight"
        style={{ letterSpacing: "-0.025em" }}
      >
        {value}
        <span className="text-xs text-muted-foreground font-medium ml-0.5">
          g
        </span>
      </div>
      <div
        className="mt-2.5 h-[3px] rounded-sm"
        style={{ background: `color-mix(in oklab, ${color} 14%, transparent)` }}
      >
        <div
          className="h-full rounded-sm"
          style={{ width: `${Math.min(100, pct)}%`, background: color }}
        />
      </div>
    </div>
  );
}
