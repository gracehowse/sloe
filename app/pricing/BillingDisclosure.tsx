/**
 * BillingDisclosure — the statutory + goodwill refund/cancellation
 * disclosure rendered under each paid tier's CTA on `/pricing`.
 *
 * Extracted from `PricingTiersGrid.tsx` (ENG-1460, 2026-07-07) purely to
 * keep that file under its screen-budget pin after the hero CTA + billing
 * selector landed — no behaviour change, copy is UNCHANGED (legal-sensitive,
 * see the ENG-1285 / T22-E notes below).
 */
export function BillingDisclosure({
  price,
  period,
  isAnnual,
  isProDark,
  stripeTaxEnabled,
  regionVatNote,
}: {
  price: string;
  period: string;
  isAnnual: boolean;
  isProDark: boolean;
  stripeTaxEnabled: boolean;
  /** H7 (2026-04-21) — UK/EU always get the inclusive-VAT note (2026-04-19
   *  consumer VAT memo), other regions fall back to the Stripe flag.
   *  T22-E: non-empty also signals UK/EU for the statutory cancellation
   *  clause — same region branch reused so the two can't drift. */
  regionVatNote: string;
}) {
  const periodNoun = isAnnual ? "year" : "month";
  // ENG-1285: annual has a real 7-day Stripe trial — the lead clause says so
  // (monthly stays trial-less); both branches keep every ARL/FTC/CRD element.
  const leadClause = isAnnual
    ? `${price}${period} with a 7-day free trial — no payment due today, first charge on Day 7. Automatically renews each ${periodNoun} until you cancel. Cancel anytime in `
    : `${price}${period}, charged today and automatically renews each ${periodNoun} until you cancel. Cancel anytime in `;
  // Tax clause: UK/EU inclusive-VAT note wins; otherwise the Stripe flag decides.
  const taxClause = regionVatNote
    ? `${regionVatNote}.`
    : stripeTaxEnabled
      ? "Price includes any applicable VAT."
      : "Price excludes any applicable taxes.";
  // T22-E (2026-04-25 paywall dark-pattern audit, item E): UK/EU
  // visitors see the statutory 14-day right alongside the 7-day
  // goodwill policy. Per the 2026-04-25 decision doc, path (a) ships
  // without counsel — we surface rights consumers already have by
  // law. Rest of world unchanged. See
  // docs/decisions/2026-04-25-uk-eu-statutory-cancellation.md.
  const isUkEu = regionVatNote.length > 0;
  // SLOE DS: disclosure body + links read on the muted-foreground hue
  // across both tiers (the cream Pro card no longer needs a bespoke slate
  // ramp). `isProDark` retained in the signature for caller compatibility;
  // colour is now token-driven and identical across tiers. Copy is
  // UNCHANGED (legal-sensitive).
  void isProDark;
  return (
    <p
      className="mt-2 text-xs leading-snug text-center text-muted-foreground"
      data-testid="billing-disclosure"
    >
      {leadClause}
      <a
        href="/account/billing"
        className="underline underline-offset-2 hover:text-foreground"
      >
        account settings
      </a>
      .{" "}
      {isUkEu ? (
        <>
          <span data-testid="billing-disclosure-statutory">
            UK/EU customers: under the Consumer Contracts Regulations 2013
            (UK) and Directive 2011/83/EU you have a 14-day right to cancel
            distance contracts for a full refund. Beyond that, our{" "}
          </span>
          <a
            href="/terms#refunds"
            className="underline underline-offset-2 hover:text-foreground"
          >
            7-day goodwill refund policy
          </a>
          {" "}applies.{" "}
        </>
      ) : (
        <>
          <a
            href="/terms#refunds"
            className="underline underline-offset-2 hover:text-foreground"
          >
            7-day refund policy
          </a>
          .{" "}
        </>
      )}
      {taxClause}
    </p>
  );
}

export default BillingDisclosure;
