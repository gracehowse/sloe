"use client";

import * as React from "react";
import { BookOpen, Check, ChevronDown, ChevronUp, Sparkles, Target } from "lucide-react";
import { isFeatureEnabled } from "../../../../lib/analytics/track";
import { computeOnboardingRevealProjection } from "../../../../lib/onboarding/revealProjection";
import {
  ONBOARDING_REVEAL_BMR_LABEL_GLOSS,
  ONBOARDING_REVEAL_BMR_LABEL_PLAIN,
  ONBOARDING_REVEAL_METHODOLOGY_GLOSS,
  ONBOARDING_REVEAL_METHODOLOGY_PLAIN,
  ONBOARDING_REVEAL_PERMISSION_QUOTE,
  ONBOARDING_REVEAL_SUBTITLE,
  ONBOARDING_REVEAL_TDEE_LABEL_GLOSS,
  ONBOARDING_REVEAL_TDEE_LABEL_PLAIN,
} from "../../../../lib/onboarding/figmaCopy";
import { useOnboarding } from "../context";
import { MethodologyNote } from "../scaffold";
import { CalorieRingDial } from "../../suppr/calorie-ring-dial";

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

  // ENG-1187 — gloss BMR / TDEE / Mifflin-St Jeor on first use behind
  // `onboarding_jargon_gloss_v1` (default-OFF). Plain copy stays as the
  // default; the glossed copy leads with the plain phrase. The
  // "Show the maths" expander below is the existing power-user affordance
  // and is intentionally left on the acronyms. Shared web ↔ mobile via
  // `figmaCopy.ts`.
  const glossOn = isFeatureEnabled("onboarding_jargon_gloss_v1");
  const bmrLabel = glossOn
    ? ONBOARDING_REVEAL_BMR_LABEL_GLOSS
    : ONBOARDING_REVEAL_BMR_LABEL_PLAIN;
  const tdeeLabel = glossOn
    ? ONBOARDING_REVEAL_TDEE_LABEL_GLOSS
    : ONBOARDING_REVEAL_TDEE_LABEL_PLAIN;
  const methodologyCopy = glossOn
    ? ONBOARDING_REVEAL_METHODOLOGY_GLOSS
    : ONBOARDING_REVEAL_METHODOLOGY_PLAIN;

  // Animated count-up — easeOutCubic over ~1.2s.
  const [displayCals, setDisplayCals] = React.useState(0);
  // 2026-05-12 (premium-bar audit DC1 — Cal AI plan-reveal borrow,
  // web parity with mobile reveal.tsx): ~700ms anticipation beat
  // before the count-up + ring sweep begin. Reads as "the engine is
  // crunching your numbers" instead of "the page just loaded".
  const [revealStarted, setRevealStarted] = React.useState(false);
  const target = targets?.target ?? 0;
  React.useEffect(() => {
    if (target === 0) {
      setDisplayCals(0);
      setRevealStarted(false);
      return;
    }
    let raf = 0;
    let cancelled = false;
    const beatTimer = window.setTimeout(() => {
      if (cancelled) return;
      setRevealStarted(true);
      const start = performance.now();
      const dur = 1200;
      const tick = (now: number) => {
        if (cancelled) return;
        const p = Math.min(1, (now - start) / dur);
        const e = 1 - Math.pow(1 - p, 3);
        setDisplayCals(Math.round(target * e));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, 700);
    return () => {
      cancelled = true;
      window.clearTimeout(beatTimer);
      cancelAnimationFrame(raf);
    };
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

  const revealProjection = computeOnboardingRevealProjection({
    goal: state.goal,
    weightKg: state.weightKg,
    paceKgPerWeek: state.paceKgPerWeek,
    weightSkipped: state.weightSkipped,
  });

  // Ring geometry

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
        <div
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success"
          aria-hidden
        >
          <Check size={28} strokeWidth={2} />
        </div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground-tertiary mb-2.5">
          Your daily target
        </div>
        {/* 2026-05-12 (premium-bar audit, B5 Reveal upgrade #2):
            re-titled from "Here's what your day looks like." → "Your
            plan is ready." Cal AI parity — leads with completion +
            reward beat. Mobile mirrored.
            Sloe reskin (Figma plan-ready 192:2 2026-06-07): plum
            Newsreader serif hero title. */}
        <h1
          className={`font-[family-name:var(--font-headline)] font-medium tracking-tight m-0 mb-5 text-foreground-brand leading-tight ${compact ? "text-[24px]" : "text-[24px]"}`}
          style={{ letterSpacing: "-0.01em", textWrap: "balance" } as React.CSSProperties}
        >
          Your plan is ready.
        </h1>
        <p className="m-0 mb-2 text-sm text-muted-foreground leading-relaxed">
          {ONBOARDING_REVEAL_SUBTITLE}
        </p>
        <p className="m-0 mb-5 font-[family-name:var(--font-headline)] text-base italic text-foreground px-4 leading-relaxed">
          &ldquo;{ONBOARDING_REVEAL_PERMISSION_QUOTE}&rdquo;
        </p>

        <div
          className="relative mx-auto"
          style={{ width: compact ? 210 : 240, height: compact ? 210 : 240 }}
        >
          {/* Sloe v3 (ENG-1225): the onboarding reveal ring is the same jewel
              watch-dial as the Today hero (CalorieRingDial), parity with mobile.
              consumed flips 0→target on `revealStarted` so the dial's grow sweeps
              to a full sage ring on the reveal beat; `hideCenter` keeps the
              reveal's bespoke centre (the "Crunching…" beat → serif count-up). */}
          <CalorieRingDial
            consumed={revealStarted ? target : 0}
            target={target}
            size={compact ? 210 : 240}
            hideCenter
          />
          <div className="absolute inset-0 flex flex-col justify-center items-center">
            {revealStarted ? (
              <>
                {/* Sloe reskin — the ring calorie numeral reads in the
                    Newsreader serif display face (Sloe ring numerals),
                    plum heading ink, matching the Today ring + Figma
                    192:2. tabular-nums preserved so the count-up
                    animation doesn't jitter. */}
                <div
                  className="font-[family-name:var(--font-display)] font-normal tracking-tight tabular-nums leading-none text-foreground-brand"
                  style={{
                    fontSize: compact ? 52 : 60,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {displayCals.toLocaleString()}
                </div>
                <div className="text-xs font-semibold text-muted-foreground mt-1.5 tracking-tight">
                  kcal / day
                </div>
              </>
            ) : (
              <div className="text-[13px] font-semibold text-muted-foreground text-center leading-snug max-w-[160px]">
                Crunching your numbers…
              </div>
            )}
          </div>
        </div>

        <p
          className="text-sm text-muted-foreground mx-auto mt-4 leading-relaxed max-w-[340px]"
          style={{ textWrap: "pretty" } as React.CSSProperties}
        >
          {goalBlurb}
        </p>
        {revealProjection ? (
          <p
            className="text-sm font-medium text-foreground-secondary mx-auto mt-3 leading-relaxed max-w-[340px]"
            data-testid="onboarding-reveal-projection"
            style={{ textWrap: "pretty" } as React.CSSProperties}
          >
            {revealProjection.sentence}
          </p>
        ) : null}
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
            color="var(--macro-carbs)"
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
            <div className="section-label">{bmrLabel}</div>
            <div className="text-lg font-bold tabular-nums text-foreground tracking-tight mt-0.5">
              {targets.bmr.toLocaleString()}
              <span className="text-[11px] text-muted-foreground font-medium ml-1">
                kcal
              </span>
            </div>
          </div>
          <div>
            <div className="section-label">{tdeeLabel}</div>
            <div className="text-lg font-bold tabular-nums text-foreground tracking-tight mt-0.5">
              {targets.tdee.toLocaleString()}
              <span className="text-[11px] text-muted-foreground font-medium ml-1">
                kcal
              </span>
            </div>
          </div>
        </div>

        <MethodologyNote>{methodologyCopy}</MethodologyNote>

        {/* 2026-05-12 (premium-bar audit B5 #3 — Cal AI parity, web
            mirror of mobile `RevealShowTheMaths`): "Show the maths"
            expandable that reveals the formula breakdown. Closed by
            default — power users tap to expand, average user reads
            the bigger blocks above. */}
        <RevealShowTheMaths
          bmr={targets.bmr}
          tdee={targets.tdee}
          target={targets.target}
          kcalAdj={targets.kcalAdj}
          goal={state.goal ?? "maintain"}
        />

        {/* 2026-05-12 (premium-bar audit DC1 — Cal AI plan-reveal borrow,
            web parity with mobile reveal.tsx). "What happens next" 3-step
            card anchors the abstract number to the daily loop. */}
        <div className="mt-4 p-3.5 rounded-xl border border-border bg-card flex flex-col gap-3.5">
          <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            What happens next
          </div>
          <RevealNextRow
            Icon={BookOpen}
            iconBg="color-mix(in oklab, var(--primary) 12%, transparent)"
            iconColor="var(--primary)"
            title="Log meals as you eat"
            sub="Search, barcode, photo, voice — whichever's fastest."
          />
          <RevealNextRow
            Icon={Target}
            iconBg="color-mix(in oklab, var(--success) 12%, transparent)"
            iconColor="var(--success)"
            title="Watch the ring fill"
            sub="Today's hero shows where you are vs your target in one glance."
          />
          <RevealNextRow
            Icon={Sparkles}
            iconBg="color-mix(in oklab, var(--macro-fat) 12%, transparent)"
            iconColor="var(--macro-fat)"
            title="Adapt over the first ~2 weeks"
            sub="As you log + weigh in, Sloe re-tunes your TDEE to what your body actually does."
          />
        </div>
      </div>
    </div>
  );
}

/**
 * RevealShowTheMaths — 2026-05-12 (premium-bar audit B5 #3, web mirror
 * of mobile `RevealShowTheMaths` in `apps/mobile/components/onboarding/
 * steps/reveal.tsx`).
 *
 * A "Show the maths" disclosure rendered below the BMR / TDEE tiles.
 * Closed by default. Tap → reveals BMR + Est. TDEE + Target rows with
 * the formula reasoning so power users can audit the numbers without
 * crowding the default state.
 */
function RevealShowTheMaths({
  bmr,
  tdee,
  target,
  kcalAdj,
  goal,
}: {
  bmr: number;
  tdee: number;
  target: number;
  kcalAdj: number;
  goal: "lose" | "maintain" | "gain" | "recomp";
}) {
  const [open, setOpen] = React.useState(false);
  const adjSigned =
    goal === "gain"
      ? `+${kcalAdj.toLocaleString()}`
      : goal === "maintain"
        ? "±0"
        : `−${Math.abs(kcalAdj).toLocaleString()}`;
  const rows: { label: string; value: string; sub: string }[] = [
    {
      label: "BMR",
      value: `${bmr.toLocaleString()} kcal`,
      sub: "Mifflin-St Jeor (sex · age · height · weight)",
    },
    {
      label: "Est. TDEE",
      value: `${tdee.toLocaleString()} kcal`,
      sub: "BMR × your activity level",
    },
    {
      label: "Target",
      value: `${target.toLocaleString()} kcal`,
      sub: `Est. TDEE ${adjSigned} kcal for your goal`,
    },
  ];
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Hide the maths" : "Show the maths"}
        className="inline-flex items-center gap-1.5 py-2 text-[11px] font-semibold text-primary hover:opacity-70 transition-opacity"
      >
        {open ? "Hide the maths" : "Show the maths"}
        {open ? (
          <ChevronUp className="size-3.5" strokeWidth={2.25} />
        ) : (
          <ChevronDown className="size-3.5" strokeWidth={2.25} />
        )}
      </button>
      {open ? (
        <div
          className="mt-1.5 rounded-xl border border-border bg-card p-3.5 space-y-3"
          role="region"
          aria-label="How your target is calculated"
        >
          {rows.map((row) => (
            <div key={row.label}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
                  {row.label}
                </span>
                <span className="text-[15px] font-bold tabular-nums text-foreground">
                  {row.value}
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                {row.sub}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function RevealNextRow({
  Icon,
  iconBg,
  iconColor,
  title,
  sub,
}: {
  Icon: typeof BookOpen;
  iconBg: string;
  iconColor: string;
  title: string;
  sub: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
        style={{ background: iconBg }}
      >
        <Icon size={16} strokeWidth={2} style={{ color: iconColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-foreground">{title}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
          {sub}
        </div>
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
  // 2026-05-13 (premium-bar audit Reveal #4 — pair macro % with g
  // inline): web parity mirror of the mobile flag-gated layout.
  // Same flag name + gating posture so both platforms flip
  // simultaneously when Grace enables `reveal-macro-tile-paired-pct`
  // in PostHog. Default OFF — original layout unchanged for real
  // users until the flag is flipped.
  const pairedLayout = isFeatureEnabled("reveal-macro-tile-paired-pct");
  return (
    <div className="bg-card border border-border rounded-xl p-3.5">
      <div className="flex justify-between items-center mb-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {name}
        </span>
        {!pairedLayout ? (
          <span
            className="text-[10px] font-bold tabular-nums"
            style={{ color }}
          >
            {pct}%
          </span>
        ) : null}
      </div>
      {/* SLOE Phase 0: the macro-target hero numeral reads in the Newsreader
          serif display face (matching the calorie ring + mobile reveal); the
          `g` unit + pct stay sans. */}
      <div
        className="font-[family-name:var(--font-display)] text-[22px] font-normal tabular-nums leading-none text-foreground tracking-tight"
        style={{ letterSpacing: "-0.025em" }}
      >
        {value}
        <span className="font-sans text-xs text-muted-foreground font-medium ml-0.5">
          g
        </span>
        {pairedLayout ? (
          <span
            className="text-xs font-bold tabular-nums ml-1.5"
            style={{ color }}
          >
            · {pct}%
          </span>
        ) : null}
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
