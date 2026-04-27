import * as React from "react";
import { cn } from "../ui/utils";
import { Icons } from "../ui/icons";

/**
 * SponsoredDisclosure — universal pattern for marking any partner /
 * affiliate / sponsored content surface.
 *
 * Spec: docs/decisions/2026-04-27-sponsored-disclosure-pattern.md
 *
 * Use this on every surface where Suppr links to or features a third
 * party we have a commercial relationship with. The disclosure is a
 * hard requirement under FTC §255.5 (US) + ASA CAP Code §3 (UK) +
 * EU Unfair Commercial Practices Directive 2005/29/EC. It must be:
 *   - clear (no euphemisms — "sponsored" / "affiliate" / "ad")
 *   - prominent (above the fold, not buried in a footer)
 *   - in the same language as the surrounding content
 *   - available in the same modality (visible, not just on hover/tap)
 *
 * Three variants:
 *   - "sponsored": paid placement, editorial decision was bought
 *   - "affiliate": commission-on-purchase only; editorial control retained
 *   - "ad": rotating display ad slot (we don't currently sell these
 *     anywhere; primitive ready for the future)
 *
 * Doesn't trigger anywhere yet (no partners as of 2026-04-27). Ship the
 * primitive ready so the first affiliate / sponsorship deal we sign
 * doesn't have to invent disclosure-pattern UI on the fly.
 */

type DisclosureKind = "sponsored" | "affiliate" | "ad";

const DISCLOSURE_LABEL: Record<DisclosureKind, string> = {
  sponsored: "Sponsored",
  affiliate: "Affiliate link",
  ad: "Ad",
};

const DISCLOSURE_TOOLTIP: Record<DisclosureKind, string> = {
  sponsored:
    "Suppr was paid by the partner to feature this content. Our editorial review still applies.",
  affiliate:
    "Suppr earns a commission if you purchase via this link, at no extra cost to you. We only link to products we'd recommend regardless.",
  ad: "Paid placement. Suppr does not endorse the advertised product.",
};

export interface SponsoredDisclosureProps
  extends Omit<React.ComponentProps<"span">, "children"> {
  kind: DisclosureKind;
  /**
   * When set, renders the partner's name inline ("Sponsored · Brand").
   * Optional — primitive is usable without it for cases where the
   * surrounding context already names the partner.
   */
  partnerName?: string;
  /**
   * `inline` (default) — small pill matching the existing badge/source-
   * badge visual scale. Lives next to a partner logo or above a tile.
   * `block` — full-width banner above a list of cards (e.g. a sponsored
   * Discover row). Visually heavier so users can't miss it.
   */
  variant?: "inline" | "block";
}

function SponsoredDisclosure({
  kind,
  partnerName,
  variant = "inline",
  className,
  ...rest
}: SponsoredDisclosureProps) {
  const label = DISCLOSURE_LABEL[kind];
  const tooltip = DISCLOSURE_TOOLTIP[kind];

  if (variant === "block") {
    return (
      <div
        data-slot="sponsored-disclosure"
        data-kind={kind}
        role="note"
        aria-label={`${label}${partnerName ? ` by ${partnerName}` : ""}`}
        className={cn(
          "flex items-center gap-2 rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground",
          className,
        )}
        title={tooltip}
      >
        <Icons.info className="size-3.5 shrink-0" aria-hidden />
        <span className="font-medium">
          {label}
          {partnerName ? <span className="font-normal"> · {partnerName}</span> : null}
        </span>
      </div>
    );
  }

  return (
    <span
      data-slot="sponsored-disclosure"
      data-kind={kind}
      role="note"
      aria-label={`${label}${partnerName ? ` by ${partnerName}` : ""}`}
      title={tooltip}
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground",
        className,
      )}
      {...rest}
    >
      <Icons.info className="size-3" aria-hidden />
      {label}
      {partnerName ? <span className="lowercase normal-case font-normal">· {partnerName}</span> : null}
    </span>
  );
}

export { SponsoredDisclosure, DISCLOSURE_LABEL, DISCLOSURE_TOOLTIP };
export type { DisclosureKind };
