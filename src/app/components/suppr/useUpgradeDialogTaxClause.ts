"use client";

/**
 * ENG-1441 (2026-07-21) — the upgrade dialog's renewal-disclosure tax
 * clause. Extracted from `upgrade-paywall-dialog.tsx` to keep that
 * screen under the ENG-621 400-line budget ratchet
 * (`scripts/screen-line-budget.json`); a plain `.ts` hook file isn't a
 * "screen" surface the ratchet scans (`.tsx` under `src/app/components`
 * + `app` only), so logic lives here instead of inline.
 *
 * Before this change the dialog's tax clause was a hardcoded,
 * unconditional "Prices include any applicable VAT." for every
 * visitor regardless of region or whether Stripe Tax was even active
 * — untrue for the majority (default-region, Stripe-Tax-off) case, and
 * the exact class of false claim `resolveRenderedVatNote` /
 * `BillingDisclosure`'s `taxClause` already guard against on
 * `/pricing`. This hook mirrors that logic exactly: UK/EU + flag-on
 * wins outright, otherwise the flag alone decides, default is the
 * honest non-claim, never the prior hardcoded VAT-inclusive line.
 *
 * Region resolves via `detectRegionFromNavigatorLanguage` — no request
 * headers are reachable from this client component, and it must not
 * self-fetch to decide its own render per D12 §6.3, so this trades the
 * CF-IPCountry signal `detectRegion` gets server-side for a
 * same-session, navigator.language-based guess; the actually-charged
 * amount/currency stays authoritative server-side at checkout
 * regardless. `useStripeTaxEnabled`
 * (`src/lib/stripe/useStripeTaxEnabled.ts`) supplies the
 * `STRIPE_TAX_ENABLED` flag via `/api/stripe/tax-status` — this dialog
 * has no single Server Component ancestor to hand it down as a prop.
 *
 * Region is computed once per mount (`useMemo`, `[]` deps) — it
 * doesn't change while a single dialog instance is mounted, and
 * re-deriving on every open/close would just churn the memo for no
 * reason.
 */
import { useMemo } from "react";
import { detectRegionFromNavigatorLanguage, resolveRenderedVatNote } from "../../../lib/region/detectRegion.ts";
import { useStripeTaxEnabled } from "../../../lib/stripe/useStripeTaxEnabled.ts";

export function useUpgradeDialogTaxClause(): string {
  const region = useMemo(() => detectRegionFromNavigatorLanguage(), []);
  const stripeTaxEnabled = useStripeTaxEnabled();
  // Same three-way branch as `BillingDisclosure`'s `taxClause` on
  // /pricing (`app/pricing/BillingDisclosure.tsx`).
  const gatedRegionVatNote = resolveRenderedVatNote(region.vatNote, stripeTaxEnabled);
  return gatedRegionVatNote
    ? `${gatedRegionVatNote}.`
    : stripeTaxEnabled
      ? "Price includes any applicable VAT."
      : "Price excludes any applicable taxes.";
}
