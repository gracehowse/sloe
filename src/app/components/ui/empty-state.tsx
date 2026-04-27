"use client";

/**
 * EmptyState — universal empty-state primitive.
 *
 * Production design spec — 2026-04-27 §Part 3 "New components".
 * The spec contract: `icon`, `title`, `body`, `primaryCta`,
 * `secondaryCta`. Replaces the older `<EmptyState>` in
 * `src/app/components/suppr/empty-state.tsx` (which uses `description`
 * + `action`) — but Phase 1 does NOT sweep callers; both coexist until
 * the Phase 2 sweep migrates them.
 *
 * Mirror: `apps/mobile/components/ui/EmptyState.tsx`.
 */

import * as React from "react";
import { cn } from "./utils";

export interface UniversalEmptyStateProps
  extends Omit<React.ComponentProps<"div">, "title"> {
  /** Lucide / custom icon node. Rendered at ~24px, muted. */
  icon?: React.ReactNode;
  /** Short title. Accepts any node so callers can preserve inline
   *  emphasis. The HTML `title` attribute is dropped from the
   *  underlying `div` to avoid a string-only conflict. */
  title: React.ReactNode;
  /** Multi-sentence body copy. Optional — sometimes the title says it
   *  all. */
  body?: React.ReactNode;
  /** Primary CTA node — usually a `<Button>`. */
  primaryCta?: React.ReactNode;
  /** Secondary CTA node — usually a ghost `<Button>` or text-button. */
  secondaryCta?: React.ReactNode;
}

export function EmptyState({
  icon,
  title,
  body,
  primaryCta,
  secondaryCta,
  className,
  ...props
}: UniversalEmptyStateProps) {
  return (
    <div
      data-slot="universal-empty-state"
      role="region"
      aria-label={typeof title === "string" ? title : undefined}
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-4 py-8 text-center",
        className,
      )}
      {...props}
    >
      {icon ? (
        <div
          aria-hidden
          className="text-muted-foreground [&>svg]:size-6 mb-1"
        >
          {icon}
        </div>
      ) : null}
      <p className="text-[15px] font-semibold text-foreground">{title}</p>
      {body ? (
        <p className="text-[13px] text-muted-foreground max-w-md">{body}</p>
      ) : null}
      {primaryCta || secondaryCta ? (
        <div className="mt-2 flex flex-col items-center gap-2 sm:flex-row sm:gap-3">
          {primaryCta}
          {secondaryCta}
        </div>
      ) : null}
    </div>
  );
}

export default EmptyState;
