"use client";

import * as React from "react";
import { Check, Link2 } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { SupprMark } from "@/app/components/ui/suppr-mark";
import { useOnboardingV2 } from "../context";

/**
 * Welcome — the cold-open landing card for the v2 flow. Renders inside
 * the right-column slot on web and full-bleed on mobile (Stage D).
 *
 * The brand gradient lives ONLY on this step + the Reveal hero (and
 * marketing) per `docs/ux/brand-guidelines.md`. Every other step uses
 * flat surfaces.
 */

interface WelcomeProps {
  /** Mobile uses tighter padding to fit the iPhone safe area. */
  compact?: boolean;
}

export function WelcomeStep({ compact = false }: WelcomeProps) {
  const { go } = useOnboardingV2();
  return (
    <div className="flex flex-col h-full justify-between">
      <div
        className={
          compact
            ? "relative flex-1 flex flex-col justify-end px-6 pt-14 pb-8 overflow-hidden"
            : "relative flex-1 flex flex-col justify-end px-8 pt-16 pb-8 overflow-hidden"
        }
      >
        {/* Gradient washes — the only place product UI shows the
            brand gradient. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at top, color-mix(in oklab, var(--primary) 28%, transparent) 0%, color-mix(in oklab, var(--macro-fat) 12%, transparent) 45%, transparent 80%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 80% 15%, color-mix(in oklab, var(--macro-fat) 22%, transparent), transparent 55%)",
          }}
        />

        <FloatingPreview compact={compact} />

        <div className="relative">
          <SupprMark size={44} />
          <h1
            className="font-extrabold tracking-tight text-foreground mt-6 mb-3 leading-[1.02]"
            style={{
              fontSize: compact ? 36 : 42,
              letterSpacing: "-0.035em",
              textWrap: "balance",
            } as React.CSSProperties}
          >
            Eat well,
            <br />
            without
            <br />
            overthinking it.
          </h1>
          <p
            className="text-muted-foreground leading-relaxed max-w-[360px]"
            style={{ fontSize: compact ? 15 : 16 }}
          >
            Import recipes from the sites you already use. We&apos;ll break down
            the macros and help you hit targets that fit your life.
          </p>
        </div>
      </div>

      <div className={compact ? "px-6 pb-7 relative" : "px-8 pb-8 relative"}>
        <Button
          size="lg"
          className="w-full h-14 text-base font-bold"
          onClick={() => go(1)}
        >
          Get started
        </Button>
        <div className="text-center mt-3.5 text-sm text-muted-foreground">
          Have an account?{" "}
          <button
            type="button"
            className="text-primary font-semibold cursor-pointer bg-transparent border-0 p-0"
          >
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
}

/** A small visual preview for the cold-open. Three floating cards
 *  hint at what the product does without slop or overpromise. */
function FloatingPreview({ compact }: { compact: boolean }) {
  return (
    <div
      className="relative mb-9"
      style={{ height: compact ? 140 : 160 }}
    >
      {/* Card 1 — "imported from" */}
      <div
        className="absolute top-0 left-[8%] right-[35%] rounded-[14px] border border-border bg-card px-3.5 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.25)]"
        style={{ transform: "rotate(-2.4deg)", backdropFilter: "blur(16px)" }}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <Link2 className="size-3 text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
            Imported
          </span>
        </div>
        <div className="text-[13px] font-semibold text-foreground tracking-tight">
          Sheet-pan chicken
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5">
          from instagram.com
        </div>
      </div>

      {/* Card 2 — macro ring snippet */}
      <div
        className="absolute top-7 right-[4%] rounded-[14px] border border-border bg-card p-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.25)]"
        style={{
          width: compact ? 170 : 190,
          transform: "rotate(2deg)",
          backdropFilter: "blur(16px)",
        }}
      >
        <div className="flex items-center gap-2.5">
          <svg
            width={48}
            height={48}
            viewBox="0 0 48 48"
            style={{ transform: "rotate(-90deg)", flexShrink: 0 }}
          >
            <circle
              cx={24}
              cy={24}
              r={20}
              stroke="var(--border)"
              strokeWidth={5}
              fill="none"
            />
            <circle
              cx={24}
              cy={24}
              r={20}
              stroke="var(--success)"
              strokeWidth={5}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={125.6}
              strokeDashoffset={34}
            />
          </svg>
          <div>
            <div className="section-label">Today</div>
            <div
              className="text-xl font-extrabold tracking-tight tabular-nums text-foreground"
              style={{ letterSpacing: "-0.02em" }}
            >
              1,420
            </div>
            <div className="text-[10px] text-muted-foreground">
              of 1,800 kcal
            </div>
          </div>
        </div>
      </div>

      {/* Card 3 — confidence chip */}
      <div
        className="absolute bottom-0 left-[20%] rounded-full border px-3 py-1.5 flex items-center gap-1.5"
        style={{
          background: "color-mix(in oklab, var(--success) 14%, transparent)",
          borderColor: "color-mix(in oklab, var(--success) 35%, transparent)",
          transform: "rotate(-1deg)",
          backdropFilter: "blur(16px)",
        }}
      >
        <Check className="size-3 text-success" strokeWidth={2.5} />
        <span className="text-[11px] font-bold text-success tracking-tight">
          Matched to USDA · 94%
        </span>
      </div>
    </div>
  );
}
