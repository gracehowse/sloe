import { resolveRenderedVatNote, type RegionInfo } from "../region/detectRegion";

/**
 * Pure render-decision helper for the web subscription-management card
 * (ENG-748 #11). Kept separate from the React component
 * (`src/app/components/settings/SubscriptionCard.tsx`) and the data
 * hook (`src/lib/stripe/useSubscriptionStatus.ts`) so every legal-P0
 * branch is unit-testable without rendering React or hitting Stripe —
 * the same shape `resolveBillingPortalOutcome` is pinned by
 * `accountBilling.test.tsx`.
 *
 * Authority: monetisation-architect + legal-reviewer designs
 * (2026-05-27, ENG-748 #11). Every verbatim string below is reproduced
 * exactly from the legal spec; drift on any of them is a legal
 * regression and the test suite (`subscriptionCardView.test.ts`)
 * exists to catch it.
 *
 * The four Stripe states + the App Store (IAP) state + Free map to a
 * discriminated `kind`:
 *   - "iap"           — managedVia === "app_store": NO web cancel
 *                       control; render the Apple-billing copy verbatim
 *                       (legal P0 MV-1 / MV-2).
 *   - "none"          — managedVia === "none": user is Free; nothing to
 *                       manage. The card host gates the hook on
 *                       userTier !== "free", so this is a defensive
 *                       fallback rather than a normal render.
 *   - "active"        — Stripe sub, renewing.
 *   - "trial"         — Stripe sub, in free trial.
 *   - "canceled"      — Stripe sub, cancelAtPeriodEnd: keep until
 *                       accessEnd, will NOT renew (legal P0 AR-7).
 *   - "past_due"      — Stripe sub, payment failed: amber banner that
 *                       links straight to /account/billing (NO export
 *                       dialog interstitial — legal P0).
 *
 * Provider-authoritative rule (legal P0 AR-3/4 + PX-1): the
 * next-charge date, amount, and currency are read straight from the
 * Stripe subscription payload and NEVER hardcoded or guessed. When
 * Stripe omits a field we render a quiet placeholder rather than
 * inventing a number.
 */

/** Subset of Stripe statuses we render distinctly. Everything Stripe
 *  can return is mapped to one of these by `resolveSubscriptionCardView`. */
export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid"
  | "paused";

/** Billing rail that owns this subscription. Mirrors the route payload. */
export type ManagedVia = "stripe" | "app_store" | "none";

/** The minimal, typed subscription payload the route returns. No raw
 *  Stripe customer object, no full card number. */
export type SubscriptionSummary = {
  status: SubscriptionStatus;
  /** "monthly" | "annual" — derived from the Stripe price interval. */
  billingPeriod: "monthly" | "annual" | null;
  /** Unix seconds (Stripe `current_period_end`). */
  currentPeriodEnd: number | null;
  /** Unix seconds (Stripe `trial_end`); null when not trialing. */
  trialEnd: number | null;
  /** Stripe `cancel_at_period_end`. */
  cancelAtPeriodEnd: boolean;
  /** Stripe price `unit_amount` in minor units (pence/cents). */
  priceAmount: number | null;
  /** ISO currency code, lower-case from Stripe (e.g. "gbp"). */
  currency: string | null;
  paymentMethodBrand: string | null;
  paymentMethodLast4: string | null;
};

export type SubscriptionCardView =
  | {
      kind: "iap";
      /** Verbatim Apple-billing copy. NO cancel control rendered. */
      body: string;
    }
  | {
      kind: "none";
      /** Free user — prompt to view plans. */
      body: string;
    }
  | {
      kind: "active";
      statusLine: string;
      /** Cancel/refund reassurance block (region-aware). */
      cancelBlock: string;
      paymentMethodLine: string | null;
      vatNote: string;
    }
  | {
      kind: "trial";
      statusLine: string;
      cancelBlock: string;
      paymentMethodLine: string | null;
      vatNote: string;
    }
  | {
      kind: "canceled";
      statusLine: string;
      paymentMethodLine: string | null;
    }
  | {
      kind: "past_due";
      /** Amber banner copy. Links straight to /account/billing. */
      bannerLine: string;
      cancelBlock: string;
      paymentMethodLine: string | null;
      vatNote: string;
    };

// --- Verbatim copy (legal-reviewer, render EXACTLY) -----------------------

export const IAP_BODY =
  'You subscribed to Pro through the App Store, so Apple manages your billing.\n\n' +
  'To change or cancel, open Settings → Apple ID → Subscriptions on your iPhone or iPad. ' +
  'For a refund, use Apple\'s "Report a Problem" (reportaproblem.apple.com) — ' +
  "we're not able to process App Store refunds for you.";

export const PAST_DUE_BANNER =
  "Payment failed — update your card to keep Pro access.";

/** Default-region cancel/refund block. UK/EU appends the statutory
 *  line — same region branch the existing BillingDisclosure UK/EU path
 *  uses (a non-empty resolved VAT note → UK/EU), so the two surfaces
 *  cannot drift. We reuse `detectRegion`'s region; we do NOT invent a
 *  second region path (legal P0). */
const CANCEL_BLOCK_DEFAULT =
  "When you cancel, you keep Pro until the end of your current billing period — " +
  "we never cut you off early or charge you again. " +
  "Changed your mind within 7 days of a charge? " +
  "Email support@getsloe.com and we'll refund it, no questions asked.";

/** UK/EU statutory addition — reuses the existing BillingDisclosure
 *  UK/EU wording so counsel only has to bless one phrasing. */
const CANCEL_BLOCK_UK_EU_STATUTORY =
  " UK/EU customers: under the Consumer Contracts Regulations 2013 (UK) and " +
  "Directive 2011/83/EU you have a 14-day right to cancel distance contracts for a full refund.";

const NONE_BODY = "You're on the Free plan. Upgrade to Pro anytime.";

// --- Formatters (provider-authoritative inputs only) ----------------------

/** Format a Stripe Unix-seconds timestamp as a human date. Returns a
 *  quiet placeholder when Stripe omits the value — we never guess a
 *  date (legal P0 PX-1 / AR-3). */
export function formatChargeDate(unixSeconds: number | null, locale: string): string {
  if (unixSeconds == null || !Number.isFinite(unixSeconds)) return "your next billing date";
  const d = new Date(unixSeconds * 1000);
  if (Number.isNaN(d.getTime())) return "your next billing date";
  return d.toLocaleDateString(locale || "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Format a Stripe minor-unit amount as a bare decimal string (no
 * currency symbol). The legal verbatim renders amount + ISO currency
 * code as two adjacent tokens (`{amount} {currency}` → "29.99 GBP"),
 * so the amount must NOT carry its own symbol or we'd double up
 * ("£29.99 GBP"). Returns a quiet placeholder when Stripe omits the
 * value — never a hardcoded number (legal P0 PX-1 / AR-4).
 */
export function formatAmount(
  minorUnits: number | null,
  currency: string | null,
  locale: string,
): string {
  if (minorUnits == null || !Number.isFinite(minorUnits) || !currency) {
    return "your plan price";
  }
  try {
    return new Intl.NumberFormat(locale || "en-GB", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(minorUnits / 100);
  } catch {
    return (minorUnits / 100).toFixed(2);
  }
}

function periodWords(billingPeriod: "monthly" | "annual" | null): {
  billedAdverb: string;
  intervalNoun: string;
} {
  if (billingPeriod === "annual") {
    return { billedAdverb: "annually", intervalNoun: "year" };
  }
  // Default to monthly framing when Stripe didn't give us an interval —
  // monthly is the default SKU (ENG-698) and the safer copy default.
  return { billedAdverb: "monthly", intervalNoun: "month" };
}

function buildCancelBlock(isUkEu: boolean): string {
  return isUkEu
    ? CANCEL_BLOCK_DEFAULT + CANCEL_BLOCK_UK_EU_STATUTORY
    : CANCEL_BLOCK_DEFAULT;
}

function buildPaymentMethodLine(sub: SubscriptionSummary): string | null {
  if (!sub.paymentMethodBrand || !sub.paymentMethodLast4) return null;
  const brand =
    sub.paymentMethodBrand.charAt(0).toUpperCase() + sub.paymentMethodBrand.slice(1);
  return `${brand} ending ${sub.paymentMethodLast4}`;
}

// --- Main entry point ------------------------------------------------------

export function resolveSubscriptionCardView(args: {
  subscription: SubscriptionSummary | null;
  managedVia: ManagedVia;
  region: RegionInfo;
  /** `STRIPE_TAX_ENABLED` — surfaced from the route payload so the
   *  client knows whether the VAT-inclusive claim is truthful. */
  taxEnabled: boolean;
}): SubscriptionCardView {
  const { subscription, managedVia, region, taxEnabled } = args;

  // 1. IAP — Apple owns billing. NO web/Stripe cancel control (legal
  //    P0 MV-1 / MV-2). Render the Apple copy verbatim. This branch
  //    wins regardless of whether a stale Stripe subscription somehow
  //    rode along.
  if (managedVia === "app_store") {
    return { kind: "iap", body: IAP_BODY };
  }

  // 2. Free / nothing to manage.
  if (managedVia === "none" || !subscription) {
    return { kind: "none", body: NONE_BODY };
  }

  const sub = subscription;
  const locale = region.locale || "en-GB";
  // Region branch reused from detectRegion → resolveRenderedVatNote.
  // A non-empty resolved VAT note means UK/EU + Stripe Tax active.
  // For the statutory-cancellation branch we key off the RAW region
  // VAT note (UK/EU is UK/EU regardless of the tax flag) so the
  // 14-day statutory right shows for UK/EU users even before Stripe
  // Tax flips — it's a right they hold by law, not a tax claim.
  const isUkEu = region.vatNote.length > 0;
  const vatNote = resolveRenderedVatNote(region.vatNote, taxEnabled)
    ? "Includes VAT."
    : "Price excludes any applicable taxes.";

  const { billedAdverb, intervalNoun } = periodWords(sub.billingPeriod);
  const bareAmount = formatAmount(sub.priceAmount, sub.currency, locale);
  const currencyUpper = (sub.currency ?? "").toUpperCase();
  // `{amount} {currency}` token group. When Stripe omitted the amount
  // we render the quiet placeholder alone (no stray currency code
  // dangling after "your plan price"); when present we join the bare
  // decimal + ISO code (legal P0 PX-1: provider-authoritative, never a
  // hardcoded number).
  const hasAmount = sub.priceAmount != null && Number.isFinite(sub.priceAmount) && !!sub.currency;
  const amountWithCurrency = hasAmount ? `${bareAmount} ${currencyUpper}` : bareAmount;
  const paymentMethodLine = buildPaymentMethodLine(sub);
  const cancelBlock = buildCancelBlock(isUkEu);

  // 3. Canceled-but-active (cancelAtPeriodEnd). Must read as
  //    "cancelled, access until [date]" — NEVER "renews" (legal P0
  //    AR-7). Checked before status so a sub that is still `active` in
  //    Stripe but flagged cancel-at-period-end renders correctly.
  if (sub.cancelAtPeriodEnd && (sub.status === "active" || sub.status === "trialing")) {
    const accessEnd = formatChargeDate(
      sub.status === "trialing" ? sub.trialEnd ?? sub.currentPeriodEnd : sub.currentPeriodEnd,
      locale,
    );
    return {
      kind: "canceled",
      statusLine:
        `Pro — cancelled.\n` +
        `You'll keep Pro until ${accessEnd}. ` +
        `Your subscription will not renew and you won't be charged again.`,
      paymentMethodLine,
    };
  }

  // 4. Past-due — payment failed. Amber banner that links straight to
  //    /account/billing (NO export-dialog interstitial — legal P0).
  if (sub.status === "past_due" || sub.status === "unpaid") {
    return {
      kind: "past_due",
      bannerLine: PAST_DUE_BANNER,
      cancelBlock,
      paymentMethodLine,
      vatNote,
    };
  }

  // 5. Trial — Stripe `trialing`. Charge happens at trialEnd.
  if (sub.status === "trialing") {
    const trialEndStr = formatChargeDate(sub.trialEnd, locale);
    return {
      kind: "trial",
      statusLine:
        `Pro — free trial.\n` +
        `Your trial ends ${trialEndStr}. ` +
        `We'll charge ${amountWithCurrency} on that date, then ${amountWithCurrency} each ${intervalNoun} until you cancel.`,
      cancelBlock,
      paymentMethodLine,
      vatNote,
    };
  }

  // 6. Active (renewing). `incomplete` / `paused` Stripe edge states
  //    fall through here and read as active — the access is live and
  //    the cancel path is the same; a quiet placeholder date covers
  //    the case where Stripe hasn't set current_period_end yet.
  const nextChargeDate = formatChargeDate(sub.currentPeriodEnd, locale);
  return {
    kind: "active",
    statusLine:
      `Pro — billed ${billedAdverb}.\n` +
      `Renews automatically on ${nextChargeDate} at ${amountWithCurrency}, ` +
      `and on each ${intervalNoun} after that until you cancel.`,
    cancelBlock,
    paymentMethodLine,
    vatNote,
  };
}
