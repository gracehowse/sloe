"use client";

/**
 * FatSecretBadge — mandatory attribution component for FatSecret Platform API.
 *
 * Authority: FatSecret Platform API Attribution Policy (contract requirement).
 * Decision: docs/decisions/2026-04-27-fatsecret-attribution-policy.md
 *
 * Renders the official "Powered by fatsecret Platform API" attribution
 * snippet using the badge image from platform.fatsecret.com.
 *
 * Usage rules (from FatSecret ToS):
 *   - Must appear wherever FatSecret-sourced content is displayed.
 *   - At least one placement must be publicly accessible without login.
 *   - Must not modify the HTML of the official attribution snippet.
 *   - The badge image must not be altered (no recolour, no resize beyond
 *     the image's natural proportions).
 *
 * Props:
 *   - variant="badge"   Official 90×15 badge image (default — use at the
 *                       bottom of any list or detail view that shows
 *                       FatSecret data).
 *   - variant="text"    Plain "Powered by fatsecret Platform API" text
 *                       fallback when an image is inappropriate (e.g.
 *                       dark-mode contexts where the badge PNG lacks
 *                       sufficient contrast).
 *   - show              When false the component renders nothing. Pass
 *                       `show={hasFatSecretContent}` at call sites so
 *                       the check stays local and rendering stays
 *                       declarative.
 *
 * Mirror: apps/mobile/components/ui/FatSecretBadge.tsx
 */

import * as React from "react";
import { cn } from "./utils";

export interface FatSecretBadgeProps extends React.ComponentProps<"a"> {
  /**
   * "badge"  — official badge image (default).
   * "text"   — plain text fallback.
   */
  variant?: "badge" | "text";
  /**
   * When false the component renders null.
   * Convenience prop so callers can write
   *   <FatSecretBadge show={recipe.verified_source === "FatSecret"} />
   * instead of a ternary.
   */
  show?: boolean;
}

/** Official badge image URL from platform.fatsecret.com */
const BADGE_IMAGE_URL =
  "https://platform.fatsecret.com/api/static/images/powered_by_fatsecret.svg";
const FATSECRET_URL = "https://www.fatsecret.com";

export function FatSecretBadge({
  variant = "badge",
  show = true,
  className,
  ...props
}: FatSecretBadgeProps) {
  if (!show) return null;

  if (variant === "text") {
    return (
      <a
        href={FATSECRET_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          // Sloe Phase 0 (2026-06-03): route the attribution off the raw
          // `text-slate-500` hardcode onto `text-muted-foreground` (ink-soft).
          // The oat page bg tipped slate-500 to 4.49:1 (just under AA); the
          // muted-foreground token clears 4.5:1 on oat AND dark-mode-swaps.
          "inline-flex items-center text-[10px] text-muted-foreground underline-offset-2 hover:underline",
          className,
        )}
        aria-label="Powered by fatsecret Platform API"
        {...props}
      >
        Powered by fatsecret Platform API
      </a>
    );
  }

  /* Badge variant — official snippet; must not be modified per ToS. */
  return (
    <a
      href={FATSECRET_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("inline-flex items-center", className)}
      aria-label="Powered by fatsecret Platform API"
      {...props}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={BADGE_IMAGE_URL}
        alt="Powered by fatsecret"
        width={90}
        height={15}
        style={{ display: "block" }}
      />
    </a>
  );
}

export default FatSecretBadge;
