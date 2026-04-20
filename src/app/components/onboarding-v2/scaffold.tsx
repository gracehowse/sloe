"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/app/components/ui/utils";

/**
 * Scaffolding shared by every step in the v2 flow:
 *
 *  - StepBody — outer padding + flex column. Step content drops in.
 *  - StepHeader — overline + title + optional subtitle. Locks the
 *    typographic rhythm at the top of every step.
 *  - MethodologyNote — the small primary-tinted "what we're doing
 *    with this number" callout used by Pace + Reveal.
 */

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
        <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-primary mb-2.5">
          {overline}
        </div>
      )}
      <h1
        className={cn(
          "font-bold tracking-tight text-foreground leading-tight m-0",
          compact ? "text-2xl" : "text-[28px]",
        )}
        style={{ textWrap: "balance" } as React.CSSProperties}
      >
        {title}
      </h1>
      {subtitle && (
        <p
          className="text-sm text-muted-foreground mt-2 leading-relaxed m-0"
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
  return (
    <div className={cn("flex flex-col h-full px-6 pt-6 pb-3", className)}>
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
