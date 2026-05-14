"use client";

import * as React from "react";
import { Check, Link2 } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { SupprWordmark } from "@/app/components/ui/suppr-mark";
import { useOnboarding } from "../context";

/**
 * Web Welcome — full-bleed cold-open hero. Two-column split: brand
 * wordmark + headline + CTAs on the left, floating product preview
 * on the right. Mirrors the prototype's `WebWelcome` component
 * (separate from the mobile cold open which uses a stacked layout
 * to fit the iPhone safe area).
 *
 * The brand gradient is allowed here (and on the Reveal hero); every
 * other step uses flat surfaces per the brand guidelines.
 */

export function WelcomeStep() {
  const { go } = useOnboarding();
  return (
    <div className="relative h-full w-full overflow-hidden bg-background text-foreground">
      {/* Gradient washes — the only place product UI shows the
          brand gradient (alongside the Reveal hero).
          2026-05-13 (premium-bar audit B1 follow-up): dampen in dark
          mode by ~50% via `dark:opacity-50`. Light mode is untouched. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 dark:opacity-50"
        style={{
          background:
            "radial-gradient(ellipse at 30% 20%, color-mix(in oklab, var(--primary) 28%, transparent), transparent 50%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 dark:opacity-50"
        style={{
          background:
            "radial-gradient(ellipse at 75% 75%, color-mix(in oklab, var(--macro-fat) 22%, transparent), transparent 55%)",
        }}
      />

      {/* Desktop: two-column hero with floating product preview.
          Mobile-web (Grace 2026-04-20): stacked single column, smaller
          headline, vertical CTAs, floating visual hidden (it doesn't
          fit the viewport and the checklist below already shows
          proof-points). Overflow-auto so tall mobile content can
          scroll within the canvas. */}
      <div className="relative grid h-full grid-cols-1 md:grid-cols-[1.1fr_1fr] items-start md:items-center gap-8 md:gap-12 px-5 py-10 md:px-16 md:py-9 overflow-auto">
        {/* Left column — wordmark, headline, body, CTAs, checklist. */}
        <div className="z-10">
          <div className="mb-7 md:mb-10">
            <SupprWordmark size={24} />
          </div>
          <h1
            className="m-0 mb-4 md:mb-5 text-[40px] md:text-[64px] font-extrabold leading-[1.05] md:leading-[1.0] text-foreground"
            style={{
              letterSpacing: "-0.04em",
              textWrap: "balance",
            } as React.CSSProperties}
          >
            Join the
            <br />
            Suppr Club.
          </h1>
          <p
            className="m-0 mb-7 md:mb-9 max-w-[520px] text-[15px] md:text-[17px] leading-[1.55] text-muted-foreground"
          >
            Eat well. Cook what you want. Know what&apos;s in it. Import recipes
            from the sites you already use — Suppr breaks down the macros and
            calibrates targets to you.
          </p>

          <div className="mb-8 md:mb-10 flex flex-col sm:flex-row gap-3 md:gap-3.5">
            <Button
              size="lg"
              onClick={() => go(1)}
              className="h-12 md:h-14 px-6 md:px-7 text-base font-bold"
            >
              Join the club — free
            </Button>
            <Button
              size="lg"
              variant="ghost"
              onClick={() => {
                // "I'm already a member" — send returning visitors to
                // the canonical sign-in entry point (Grace 2026-04-20).
                if (typeof window !== "undefined") {
                  window.location.href = "/login";
                }
              }}
              className="h-12 md:h-14 px-6 md:px-7 text-base font-semibold text-foreground hover:bg-muted/50"
            >
              I&apos;m already a member
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-8 text-xs">
            <Checkline>Adaptive TDEE that learns from you</Checkline>
            <Checkline>One-tap import from any recipe site</Checkline>
            <Checkline>Calm design, private by default</Checkline>
          </div>
        </div>

        {/* Right column — floating product preview (hidden on mobile). */}
        <div className="relative hidden md:flex h-full items-center justify-center">
          <WebWelcomeVisual />
        </div>
      </div>
    </div>
  );
}

function Checkline({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <div
        aria-hidden
        className="grid size-[18px] shrink-0 place-items-center rounded-full"
        style={{ background: "color-mix(in oklab, var(--success) 20%, transparent)" }}
      >
        <Check className="size-[11px] text-success" strokeWidth={3} />
      </div>
      <span className="font-medium text-muted-foreground leading-snug">
        {children}
      </span>
    </div>
  );
}

function WebWelcomeVisual() {
  return (
    <div
      className="relative"
      style={{ width: 440, height: 520 }}
      // P1 (customer-lens 2026-05-11): the welcome visual is a marketing
      // illustration, not real product state. Marked aria-hidden so
      // screen-readers don't announce "Today / On track / Sheet-pan
      // chicken / Importing" as if the user had data.
      aria-hidden
    >
      {/* Main "Today" card preview */}
      <div
        className="absolute right-0 top-10 w-[380px] rounded-[22px] border bg-card p-6 backdrop-blur-xl"
        style={{
          borderColor: "var(--border)",
          boxShadow:
            "0 40px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04)",
        }}
      >
        {/* P1 (2026-05-11): explicit "Example" badge so the card reads
            as a marketing illustration rather than real state. */}
        <div className="absolute right-4 top-4 rounded-full border border-border bg-input-background px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          Example
        </div>
        <div className="mb-4 flex items-baseline justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Your Today, soon
            </div>
            <div
              className="mt-0.5 text-[22px] font-bold text-foreground"
              style={{ letterSpacing: "-0.02em" }}
            >
              Today
            </div>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-bold text-success">
            <Check className="size-[11px]" strokeWidth={3} />
            On track
          </div>
        </div>

        <div className="mb-4 flex items-center gap-4">
          <div className="relative size-[110px] shrink-0">
            <svg
              width={110}
              height={110}
              viewBox="0 0 110 110"
              style={{ transform: "rotate(-90deg)" }}
            >
              <circle
                cx={55}
                cy={55}
                r={46}
                stroke="var(--input-background)"
                strokeWidth={9}
                fill="none"
              />
              <circle
                cx={55}
                cy={55}
                r={46}
                stroke="var(--success)"
                strokeWidth={9}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={289}
                strokeDashoffset={62}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                left
              </div>
              <div
                className="text-[26px] font-extrabold leading-none tabular-nums text-foreground"
                style={{ letterSpacing: "-0.03em" }}
              >
                380
              </div>
              <div className="mt-px text-[9px] text-muted-foreground">
                of 1,800
              </div>
            </div>
          </div>
          <div className="flex-1">
            <MiniMacro name="Protein" v="92" t="140g" pct={66} c="var(--primary)" />
            <MiniMacro name="Carbs" v="168" t="180g" pct={93} c="var(--warning)" />
            <MiniMacro name="Fat" v="48" t="60g" pct={80} c="var(--macro-fat)" />
          </div>
        </div>

        <div className="flex items-center gap-2.5 rounded-xl bg-input-background p-3">
          <div
            className="grid size-8 place-items-center rounded-lg"
            style={{
              background: "color-mix(in oklab, var(--primary) 14%, transparent)",
            }}
          >
            <Link2 className="size-3.5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-foreground">
              Sheet-pan chicken bowl
            </div>
            <div className="mt-px text-[10px] text-muted-foreground">
              from instagram.com
            </div>
          </div>
          <div className="text-[13px] font-bold tabular-nums text-foreground">
            620
          </div>
        </div>
      </div>

      {/*
        Floating import card. P1 follow-up (2026-05-11 visual verify):
        the spinner + "Importing / Korean beef bowl / 12 ingredients
        matched" reads as a real import-in-progress to a first-time
        user. Killed the spinner animation, dropped the "Importing"
        past-tense progress label, and relabelled as "What we can
        match" — present-tense capability illustration rather than
        active state. Matches the "Example" treatment on the main
        Today card.
      */}
      <div
        className="absolute left-0 top-0 w-[240px] rounded-2xl border bg-card p-3.5 backdrop-blur-xl"
        style={{
          borderColor: "var(--border)",
          transform: "rotate(-4deg)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
        }}
      >
        <div className="mb-2.5 flex items-center gap-2">
          <InstagramGlyph />
          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            What we match
          </span>
          <div className="flex-1" />
          <span className="rounded-full border border-border bg-input-background px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            Example
          </span>
        </div>
        <div
          className="text-[13px] font-semibold text-foreground"
          style={{ letterSpacing: "-0.01em" }}
        >
          Korean beef bowl
        </div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">
          ingredients matched against USDA / OFF
        </div>
      </div>

      {/*
        Floating weekly insight. P1 follow-up (2026-05-11): "Protein
        intake up 18%" with a 7-bar chart reads as the user's own
        history. Relabelled to "Weekly insights — what you'll see" so
        the present-tense "what you'll see" framing makes the card
        clearly aspirational.
      */}
      <div
        className="absolute bottom-10 left-5 w-[260px] rounded-2xl border p-4 backdrop-blur-xl"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in oklab, var(--primary) 25%, transparent), color-mix(in oklab, var(--macro-fat) 18%, transparent))",
          borderColor: "color-mix(in oklab, var(--primary) 25%, transparent)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
          transform: "rotate(3deg)",
        }}
      >
        <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.1em] text-primary">
          <span>Weekly insights</span>
          <span className="rounded-full border border-primary/40 bg-background/60 px-1.5 py-0.5 text-[8px] tracking-[0.1em] text-primary">
            Example
          </span>
        </div>
        <div
          className="mb-2 text-sm font-bold text-foreground"
          style={{ letterSpacing: "-0.01em" }}
        >
          See how your week is trending
        </div>
        <div className="flex h-7 items-end gap-[3px]">
          {[30, 42, 38, 55, 62, 72, 80].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-[2px]"
              style={{
                height: `${h}%`,
                background:
                  "linear-gradient(180deg, var(--primary), color-mix(in oklab, var(--primary) 35%, transparent))",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function MiniMacro({
  name,
  v,
  t,
  pct,
  c,
}: {
  name: string;
  v: string;
  t: string;
  pct: number;
  c: string;
}) {
  return (
    <div className="mb-1.5">
      <div className="mb-[3px] flex justify-between text-[10px] font-semibold text-muted-foreground">
        <span className="uppercase tracking-[0.08em]">{name}</span>
        <span className="tabular-nums text-foreground">
          {v} <span className="text-muted-foreground">/ {t}</span>
        </span>
      </div>
      <div className="h-[3px] overflow-hidden rounded-sm bg-input-background">
        <div
          className="h-full"
          style={{ width: `${pct}%`, background: c }}
        />
      </div>
    </div>
  );
}

/** Instagram-style camera glyph — small, brand-tinted. Avoids
 *  shipping the Instagram logo (TM) directly. */
function InstagramGlyph() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <rect
        x={2}
        y={2}
        width={20}
        height={20}
        rx={5}
        stroke="var(--macro-fat)"
        strokeWidth={2}
      />
      <circle
        cx={12}
        cy={12}
        r={4}
        stroke="var(--macro-fat)"
        strokeWidth={2}
      />
      <circle cx={17.5} cy={6.5} r={1} fill="var(--macro-fat)" />
    </svg>
  );
}
