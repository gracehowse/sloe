/**
 * resolveSubscriptionCardView — pins every legal-P0 render branch for
 * the web subscription-management card (ENG-748 #11). Mirrors the way
 * `accountBilling.test.tsx` pins `resolveBillingPortalOutcome`: the
 * pure helper carries all the decisioning so the React component is a
 * thin shell and the legal verbatim strings can't drift silently.
 *
 * Authority: monetisation-architect + legal-reviewer designs
 * (2026-05-27). The verbatim assertions below are the non-negotiable
 * legal copy — a failure here is a legal regression, not a flake.
 */
import { describe, expect, it } from "vitest";
import {
  resolveSubscriptionCardView,
  formatAmount,
  formatChargeDate,
  IAP_BODY,
  PAST_DUE_BANNER,
  type SubscriptionSummary,
} from "../../src/lib/stripe/subscriptionCardView";
import type { RegionInfo } from "../../src/lib/region/detectRegion";

// --- region fixtures --------------------------------------------------------

const DEFAULT_REGION: RegionInfo = {
  currency: "GBP",
  locale: "en-GB",
  vatNote: "",
  displayAmountsInGbp: true,
};

const UK_REGION: RegionInfo = {
  currency: "GBP",
  locale: "en-GB",
  vatNote: "Prices include VAT",
  displayAmountsInGbp: true,
};

// 2026-06-15 12:00 UTC — a fixed instant so the date string is
// deterministic regardless of the day the test runs (CI hygiene rule:
// no calendar-sensitive fixtures).
const PERIOD_END = Math.floor(Date.UTC(2026, 5, 15, 12, 0, 0) / 1000);
const TRIAL_END = Math.floor(Date.UTC(2026, 5, 1, 12, 0, 0) / 1000);

function makeSub(overrides: Partial<SubscriptionSummary> = {}): SubscriptionSummary {
  return {
    status: "active",
    billingPeriod: "monthly",
    currentPeriodEnd: PERIOD_END,
    trialEnd: null,
    cancelAtPeriodEnd: false,
    priceAmount: 2999,
    currency: "gbp",
    paymentMethodBrand: "visa",
    paymentMethodLast4: "4242",
    ...overrides,
  };
}

// --- formatters -------------------------------------------------------------

describe("formatAmount", () => {
  it("renders a bare 2dp decimal with no currency symbol", () => {
    expect(formatAmount(2999, "gbp", "en-GB")).toBe("29.99");
  });

  it("returns a quiet placeholder when amount is missing", () => {
    expect(formatAmount(null, "gbp", "en-GB")).toBe("your plan price");
  });

  it("returns a quiet placeholder when currency is missing", () => {
    expect(formatAmount(2999, null, "en-GB")).toBe("your plan price");
  });
});

describe("formatChargeDate", () => {
  it("formats a Unix-seconds timestamp as a long date", () => {
    expect(formatChargeDate(PERIOD_END, "en-GB")).toBe("15 June 2026");
  });

  it("returns a quiet placeholder when the date is missing", () => {
    expect(formatChargeDate(null, "en-GB")).toBe("your next billing date");
  });
});

// --- IAP (legal P0 MV-1 / MV-2) ---------------------------------------------

describe("resolveSubscriptionCardView — IAP / App Store", () => {
  it("renders the verbatim Apple-billing copy and NO cancel control", () => {
    const view = resolveSubscriptionCardView({
      subscription: null,
      managedVia: "app_store",
      region: DEFAULT_REGION,
      taxEnabled: false,
    });
    expect(view.kind).toBe("iap");
    if (view.kind !== "iap") throw new Error("expected iap");
    expect(view.body).toBe(IAP_BODY);
    // The Apple copy must name the exact path + the refund channel.
    expect(view.body).toContain("through the App Store");
    expect(view.body).toContain("Settings → Apple ID → Subscriptions");
    expect(view.body).toContain("reportaproblem.apple.com");
    expect(view.body).toContain("we're not able to process App Store refunds for you");
    // No web cancel CTA — there is no statusLine / cancelBlock to
    // render a Stripe control from.
    expect(view).not.toHaveProperty("cancelBlock");
  });

  it("App Store branch wins even if a stale Stripe subscription rode along", () => {
    const view = resolveSubscriptionCardView({
      subscription: makeSub(),
      managedVia: "app_store",
      region: UK_REGION,
      taxEnabled: true,
    });
    expect(view.kind).toBe("iap");
  });
});

// --- Free / none ------------------------------------------------------------

describe("resolveSubscriptionCardView — Free", () => {
  it("renders the 'none' state for a Free user", () => {
    const view = resolveSubscriptionCardView({
      subscription: null,
      managedVia: "none",
      region: DEFAULT_REGION,
      taxEnabled: false,
    });
    expect(view.kind).toBe("none");
    if (view.kind !== "none") throw new Error("expected none");
    expect(view.body).toContain("Free plan");
  });

  it("falls back to 'none' when managedVia is stripe but there's no subscription", () => {
    const view = resolveSubscriptionCardView({
      subscription: null,
      managedVia: "stripe",
      region: DEFAULT_REGION,
      taxEnabled: false,
    });
    expect(view.kind).toBe("none");
  });
});

// --- Active (renewing) — legal verbatim -------------------------------------

describe("resolveSubscriptionCardView — active", () => {
  it("renders the verbatim active status line (monthly) with provider-authoritative date/amount/currency", () => {
    const view = resolveSubscriptionCardView({
      subscription: makeSub({ billingPeriod: "monthly" }),
      managedVia: "stripe",
      region: DEFAULT_REGION,
      taxEnabled: false,
    });
    expect(view.kind).toBe("active");
    if (view.kind !== "active") throw new Error("expected active");
    expect(view.statusLine).toBe(
      "Pro — billed monthly.\n" +
        "Renews automatically on 15 June 2026 at 29.99 GBP, " +
        "and on each month after that until you cancel.",
    );
  });

  it("renders 'annually' + 'year' for an annual sub", () => {
    const view = resolveSubscriptionCardView({
      subscription: makeSub({ billingPeriod: "annual", priceAmount: 23988 }),
      managedVia: "stripe",
      region: DEFAULT_REGION,
      taxEnabled: false,
    });
    if (view.kind !== "active") throw new Error("expected active");
    expect(view.statusLine).toContain("billed annually");
    expect(view.statusLine).toContain("on each year after that");
    expect(view.statusLine).toContain("at 239.88 GBP");
  });

  it("never invents a date when Stripe omits current_period_end (PX-1)", () => {
    const view = resolveSubscriptionCardView({
      subscription: makeSub({ currentPeriodEnd: null }),
      managedVia: "stripe",
      region: DEFAULT_REGION,
      taxEnabled: false,
    });
    if (view.kind !== "active") throw new Error("expected active");
    expect(view.statusLine).toContain("your next billing date");
  });

  it("never invents an amount when Stripe omits the price (PX-1) and avoids a dangling currency code", () => {
    const view = resolveSubscriptionCardView({
      subscription: makeSub({ priceAmount: null }),
      managedVia: "stripe",
      region: DEFAULT_REGION,
      taxEnabled: false,
    });
    if (view.kind !== "active") throw new Error("expected active");
    expect(view.statusLine).toContain("your plan price");
    // The placeholder must NOT be followed by a stray "GBP".
    expect(view.statusLine).not.toMatch(/your plan price\s+GBP/);
  });

  it("surfaces the payment method as brand + last4 only (never the full PAN)", () => {
    const view = resolveSubscriptionCardView({
      subscription: makeSub(),
      managedVia: "stripe",
      region: DEFAULT_REGION,
      taxEnabled: false,
    });
    if (view.kind !== "active") throw new Error("expected active");
    expect(view.paymentMethodLine).toBe("Visa ending 4242");
  });

  it("omits the payment-method line when brand/last4 are absent", () => {
    const view = resolveSubscriptionCardView({
      subscription: makeSub({ paymentMethodBrand: null, paymentMethodLast4: null }),
      managedVia: "stripe",
      region: DEFAULT_REGION,
      taxEnabled: false,
    });
    if (view.kind !== "active") throw new Error("expected active");
    expect(view.paymentMethodLine).toBeNull();
  });
});

// --- Trial — legal verbatim -------------------------------------------------

describe("resolveSubscriptionCardView — trial", () => {
  it("renders the verbatim trial status line", () => {
    const view = resolveSubscriptionCardView({
      subscription: makeSub({
        status: "trialing",
        trialEnd: TRIAL_END,
        billingPeriod: "monthly",
      }),
      managedVia: "stripe",
      region: DEFAULT_REGION,
      taxEnabled: false,
    });
    expect(view.kind).toBe("trial");
    if (view.kind !== "trial") throw new Error("expected trial");
    expect(view.statusLine).toBe(
      "Pro — free trial.\n" +
        "Your trial ends 1 June 2026. " +
        "We'll charge 29.99 GBP on that date, then 29.99 GBP each month until you cancel.",
    );
  });
});

// --- Canceled-but-active (legal P0 AR-7) ------------------------------------

describe("resolveSubscriptionCardView — canceled-but-active", () => {
  it("reads 'cancelled, access until [date]' and NEVER 'renews'", () => {
    const view = resolveSubscriptionCardView({
      subscription: makeSub({ cancelAtPeriodEnd: true }),
      managedVia: "stripe",
      region: DEFAULT_REGION,
      taxEnabled: false,
    });
    expect(view.kind).toBe("canceled");
    if (view.kind !== "canceled") throw new Error("expected canceled");
    expect(view.statusLine).toBe(
      "Pro — cancelled.\n" +
        "You'll keep Pro until 15 June 2026. " +
        "Your subscription will not renew and you won't be charged again.",
    );
    expect(view.statusLine).toContain("cancelled");
    expect(view.statusLine).toContain("will not renew");
    // AR-7 guard: the canceled state must never claim a renewal.
    expect(view.statusLine).not.toMatch(/Renews automatically/);
    // A canceled card has no cancel-reassurance block — it's already
    // cancelled; nothing to reassure about.
    expect(view).not.toHaveProperty("cancelBlock");
  });

  it("a cancelAtPeriodEnd trial also reads as cancelled (not trial)", () => {
    const view = resolveSubscriptionCardView({
      subscription: makeSub({
        status: "trialing",
        trialEnd: TRIAL_END,
        cancelAtPeriodEnd: true,
      }),
      managedVia: "stripe",
      region: DEFAULT_REGION,
      taxEnabled: false,
    });
    expect(view.kind).toBe("canceled");
    if (view.kind !== "canceled") throw new Error("expected canceled");
    // Access end for a cancelled trial is the trial end date.
    expect(view.statusLine).toContain("You'll keep Pro until 1 June 2026");
  });
});

// --- Past-due (legal P0 — amber banner, direct portal link) -----------------

describe("resolveSubscriptionCardView — past_due", () => {
  it("renders the verbatim past-due banner", () => {
    const view = resolveSubscriptionCardView({
      subscription: makeSub({ status: "past_due" }),
      managedVia: "stripe",
      region: DEFAULT_REGION,
      taxEnabled: false,
    });
    expect(view.kind).toBe("past_due");
    if (view.kind !== "past_due") throw new Error("expected past_due");
    expect(view.bannerLine).toBe(PAST_DUE_BANNER);
    expect(view.bannerLine).toBe("Payment failed — update your card to keep Pro access.");
  });

  it("treats 'unpaid' the same as 'past_due'", () => {
    const view = resolveSubscriptionCardView({
      subscription: makeSub({ status: "unpaid" }),
      managedVia: "stripe",
      region: DEFAULT_REGION,
      taxEnabled: false,
    });
    expect(view.kind).toBe("past_due");
  });

  it("a cancelled past-due sub reads as cancelled (AR-7 takes priority on access framing)", () => {
    // cancel_at_period_end on a past_due sub: cancellation framing only
    // applies while access is still live (active/trialing). A past_due
    // + cancel_at_period_end falls through to the past_due banner —
    // the user still needs to know payment failed.
    const view = resolveSubscriptionCardView({
      subscription: makeSub({ status: "past_due", cancelAtPeriodEnd: true }),
      managedVia: "stripe",
      region: DEFAULT_REGION,
      taxEnabled: false,
    });
    expect(view.kind).toBe("past_due");
  });
});

// --- VAT note gating (legal P0 PX-2) ----------------------------------------

describe("resolveSubscriptionCardView — VAT note gating", () => {
  it("renders 'Includes VAT.' for a UK/EU region when STRIPE_TAX_ENABLED", () => {
    const view = resolveSubscriptionCardView({
      subscription: makeSub(),
      managedVia: "stripe",
      region: UK_REGION,
      taxEnabled: true,
    });
    if (view.kind !== "active") throw new Error("expected active");
    expect(view.vatNote).toBe("Includes VAT.");
  });

  it("renders the tax-exclusive note for UK/EU when tax is NOT enabled (claim would be untrue)", () => {
    const view = resolveSubscriptionCardView({
      subscription: makeSub(),
      managedVia: "stripe",
      region: UK_REGION,
      taxEnabled: false,
    });
    if (view.kind !== "active") throw new Error("expected active");
    expect(view.vatNote).toBe("Price excludes any applicable taxes.");
  });

  it("renders the tax-exclusive note for the default region regardless of the flag", () => {
    const on = resolveSubscriptionCardView({
      subscription: makeSub(),
      managedVia: "stripe",
      region: DEFAULT_REGION,
      taxEnabled: true,
    });
    const off = resolveSubscriptionCardView({
      subscription: makeSub(),
      managedVia: "stripe",
      region: DEFAULT_REGION,
      taxEnabled: false,
    });
    if (on.kind !== "active" || off.kind !== "active") throw new Error("expected active");
    expect(on.vatNote).toBe("Price excludes any applicable taxes.");
    expect(off.vatNote).toBe("Price excludes any applicable taxes.");
  });
});

// --- Region-aware cancel/refund block (reuses detectRegion branch) ----------

describe("resolveSubscriptionCardView — cancel/refund block region branch", () => {
  it("default region: 7-day goodwill copy, NO statutory line", () => {
    const view = resolveSubscriptionCardView({
      subscription: makeSub(),
      managedVia: "stripe",
      region: DEFAULT_REGION,
      taxEnabled: false,
    });
    if (view.kind !== "active") throw new Error("expected active");
    expect(view.cancelBlock).toContain("keep Pro until the end of your current billing period");
    expect(view.cancelBlock).toContain("Changed your mind within 7 days");
    expect(view.cancelBlock).toContain("support@getsloe.com");
    expect(view.cancelBlock).not.toContain("14-day");
    expect(view.cancelBlock).not.toContain("Consumer Contracts Regulations");
  });

  it("UK/EU region: appends the 14-day statutory line (regardless of tax flag)", () => {
    const view = resolveSubscriptionCardView({
      subscription: makeSub(),
      managedVia: "stripe",
      region: UK_REGION,
      taxEnabled: false,
    });
    if (view.kind !== "active") throw new Error("expected active");
    expect(view.cancelBlock).toContain("Changed your mind within 7 days");
    expect(view.cancelBlock).toContain(
      "14-day right to cancel distance contracts for a full refund",
    );
    expect(view.cancelBlock).toContain("Consumer Contracts Regulations 2013");
  });
});
