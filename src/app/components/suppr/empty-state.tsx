"use client";

/**
 * Suppr `<EmptyState />` — the single empty-state primitive (audit M5,
 * 2026-04-18).
 *
 * Before this primitive shipped, each empty-state card invented its own
 * copy + layout — QuickAddPanel alone had 4 bespoke versions. This
 * component keeps the shape (icon / title / description / optional
 * action) identical everywhere, so users don't read different tabs as
 * "different apps glued together."
 *
 * Shape:
 *  - Optional `icon` slot (rendered at 24px, muted).
 *  - `title` (semibold, foreground).
 *  - `description` (muted text, small).
 *  - Optional `action` slot for a CTA (a primary button, typically).
 *
 * Copy stays at the call site — the component enforces no copy rules
 * beyond a factual, non-shame voice.
 *
 * Mirror: `apps/mobile/components/EmptyState.tsx` (same prop contract,
 * same strings).
 */

import * as React from "react";
import { cn } from "../ui/utils";

export interface EmptyStateProps {
  /** Optional lucide / custom icon rendered at ~24px, muted. */
  icon?: React.ReactNode;
  /** Short title — typically a plain string, but accepts rich content
   *  (`<span>` / `<strong>` etc.) so callers can preserve existing
   *  inline emphasis without forking the primitive. */
  title: React.ReactNode;
  /** Multi-sentence factual description. No shame, no hype. */
  description?: React.ReactNode;
  /** Optional action node — usually a button. Rendered below the
   *  description with a small top margin. */
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      data-slot="suppr-empty-state"
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 px-4 py-6 text-center",
        className,
      )}
    >
      {icon ? (
        <div aria-hidden className="text-muted-foreground [&>svg]:size-6">
          {icon}
        </div>
      ) : null}
      <p className="text-[13px] font-semibold text-foreground">{title}</p>
      {description ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

export default EmptyState;
