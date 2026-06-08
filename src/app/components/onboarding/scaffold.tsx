"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/app/components/ui/utils";
import { useOnboarding } from "./context";

/**
 * Scaffolding shared by every step in the v2 flow:
 *
 *  - StepBody — outer padding + flex column. Step content drops in.
 *  - StepHeader — overline + title + optional subtitle. Locks the
 *    typographic rhythm at the top of every step.
 *  - MethodologyNote — the small primary-tinted "what we're doing
 *    with this number" callout used by Pace + Reveal.
 *  - useStepOverline — returns "Step 02 of 12" derived from context
 *    so step components don't hardcode the count (and don't ship
 *    "Step 13 of 12" copy bugs ever again).
 */

/** Derive the canonical step overline from context. Welcome (step 0)
 *  has no overline, so this is only called from the other 12 steps.
 *  Convention: 1-indexed display starting at signup, matching the
 *  prototype's "Step 02 / 03 …" pattern. */
export function useStepOverline(): string {
  const { displayIndex, displayTotal } = useOnboarding();
  return `Step ${String(displayIndex).padStart(2, "0")} of ${displayTotal}`;
}

interface StepHeaderProps {
  overline?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Tighter top + bottom margin for steps that already have a lot of
   *  content below (Pace, Reveal). */
  compact?: boolean;
}

export function StepHeader({
  overline,
  title,
  subtitle,
  compact = false,
}: StepHeaderProps) {
  return (
    <div className={cn(compact ? "mb-5" : "mb-7")}>
      {overline && (
        // Sloe reskin (Figma onboarding parity 2026-06-07): the step
        // overline is a calm muted-ink label, not a primary-tinted
        // shout. The clay accent is reserved for the CTA + selected
        // states per the Sloe three-role colour law.
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground-tertiary mb-2.5">
          {overline}
        </div>
      )}
      {/* Sloe reskin — step titles read in plum Newsreader serif
          (`--font-headline` / `text-foreground-brand`), matching the
          approved Figma onboarding frames (285:2 / 189:2 / 191:2 /
          269:2 / 273:2). The old bold-sans treatment was the last
          onboarding surface still on the pre-Sloe display idiom. */}
      <h1
        className={cn(
          "font-[family-name:var(--font-headline)] font-medium tracking-tight text-foreground-brand leading-tight m-0",
          compact ? "text-[26px]" : "text-[30px]",
        )}
        style={{ textWrap: "balance" } as React.CSSProperties}
      >
        {title}
      </h1>
      {subtitle && (
        <p
          className="text-sm text-muted-foreground mt-2.5 leading-relaxed m-0"
          style={{ textWrap: "pretty" } as React.CSSProperties}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

interface StepBodyProps {
  children: React.ReactNode;
  className?: string;
}

export function StepBody({ children, className }: StepBodyProps) {
  // Symmetric pt/pb (pb-6) per visual-qa P1 — pb-3 was lopsided vs
  // pt-6 and made bottom-row elements (MethodologyNote, "Prefer not
  // to enter" footer) feel cut off inside the rounded card.
  return (
    <div className={cn("flex flex-col h-full px-6 py-6", className)}>
      {children}
    </div>
  );
}

interface MethodologyNoteProps {
  children: React.ReactNode;
}

export function MethodologyNote({ children }: MethodologyNoteProps) {
  return (
    <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-primary/15 bg-primary/5 p-3 text-xs leading-relaxed text-muted-foreground">
      <Sparkles
        className="size-3.5 shrink-0 text-primary mt-px"
        aria-hidden
      />
      <div className="flex-1">{children}</div>
    </div>
  );
}
