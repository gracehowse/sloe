/**
 * Paywall trust-copy SSOT (leaf — no `@/…` aliases).
 *
 * Counter to the #1 most-cited pain across the competitive set
 * (Cal AI, Lifesum, Yazio, Lose It, Recime, Honeydew per the
 * 2026-04-30 user-sentiment audit): hidden prices, surprise
 * renewals, refund-friction, "subscription billed via website,
 * not iTunes" cancellation traps.
 *
 * Suppr's differentiation is **honest billing**: explicit,
 * in-app, refundable. Three trust tokens are surfaced ABOVE
 * the price grid on every paid surface so the promise is the
 * first thing the user reads — not buried in 11px legal grey.
 *
 * Lives alongside `./pricingTiers` and `./nutritionSources` as
 * a mobile-safe leaf so the React Native paywall can import it
 * directly without pulling `src/lib/landing/content.ts`' full
 * dependency graph (which uses `@/…` aliases that don't resolve
 * in `apps/mobile/tsconfig.json`).
 *
 * Copy rules:
 *   - Each chip is one short clause. No periods, no ellipses.
 *   - "Cancel anytime in-app" — in-app, not via support.
 *   - "7-day refund, no email" — immediate path, not gated on
 *     a support ticket. (Pre-purchase the path is still
 *     `support@getsloe.com` in the disclosure copy because
 *     refunds are processed manually via Stripe; the chip
 *     surfaces the timing + no-friction promise.)
 *   - "No surprise price increases" — directly counters Lose
 *     It's "auto-renewal at $39.99 immediately after trial"
 *     dark-pattern. Deliberately period-neutral (ENG-1436 legal
 *     P0): only annual carries a trial (ENG-1285), so the earlier
 *     "mid-trial" wording was a false trial claim on the monthly
 *     selection.
 */

export type PaywallTrustChip = {
  /** Short clause rendered inside the chip. No trailing period. */
  label: string;
  /** Long-form accessibility label — VoiceOver / TalkBack speaks
   *  this when focusing the chip, so the meaning isn't reduced
   *  to the truncated visual clause. */
  a11yLabel: string;
};

/** ENG-970 — trial-state honesty chip above the purchase CTA (mobile IAP). */
export const PAYWALL_NO_PAYMENT_DUE_CHIP = {
  testId: "paywall-no-payment-due-chip",
  label: "No payment due now — first charge on Day 7",
  a11yLabel:
    "No payment due now. Your first charge happens on day seven after you start the free trial.",
} as const;

/** Figma `284:2` trust-row lead clause (ENG-901). Paired with the
 *  platform cancel chip from `getPaywallTrustChips`. */
export const PAYWALL_TRUST_SECURE_CHECKOUT = {
  label: "Secure checkout",
  a11yLabel: "Secure checkout through Apple or Stripe.",
} as const;

/**
 * Three trust chips, displayed in a horizontal strip above the
 * pricing tiers on every paid surface. Order is fixed:
 *   1. Cancel anytime — answers "can I get out?"
 *   2. 7-day refund — answers "what if I change my mind?"
 *   3. No surprise price increases — answers "will I be
 *      surprised at renewal?"
 *
 * Mobile renders these with `lucide-react-native#ShieldCheck`,
 * web renders with `lucide-react#ShieldCheck`. Keep the icon
 * choice consistent across platforms so the visual weight matches.
 *
 * DC4 (premium-bar audit 2026-05-14): the cancellation chip is
 * platform-specific so users see the exact path they'll take.
 *   - Web → Stripe Customer Portal (linked from Account → Billing)
 *   - Mobile → App Store subscription manager
 * Use `getPaywallTrustChips(platform)` to pick the right set; the
 * exported `PAYWALL_TRUST_CHIPS` default keeps the platform-neutral
 * "in-app" copy for any caller that doesn't know its platform yet
 * (e.g. shared landing surfaces before checkout-tier selection).
 */
export type PaywallTrustPlatform = "web" | "mobile";

const CANCEL_CHIP_BY_PLATFORM: Record<PaywallTrustPlatform, PaywallTrustChip> = {
  web: {
    label: "Cancel in Stripe Portal",
    a11yLabel:
      "Cancel in the Stripe Customer Portal. Open Account, then Billing — you can cancel or pause in one click without contacting support.",
  },
  mobile: {
    label: "Cancel anytime in App Store",
    a11yLabel:
      "Cancel anytime in the App Store. Open Settings, then Apple ID, then Subscriptions — you can cancel or pause without contacting support.",
  },
};

const SHARED_TRUST_CHIPS: ReadonlyArray<PaywallTrustChip> = [
  {
    label: "7-day refund, no email needed",
    a11yLabel:
      "7-day refund. Refunds are processed within 7 days of purchase, with no support email required for trial cancellations.",
  },
  {
    label: "No surprise price increases",
    a11yLabel:
      "No surprise price increases. The price you see is the price you pay — it never changes at renewal without you agreeing first.",
  },
];

/**
 * Resolve the three trust chips for a specific platform. The
 * cancellation chip swaps in the platform-correct surface (Stripe
 * Portal on web, App Store on mobile) so users read the exact path
 * they'll take, not a generic "in-app" line that obscures whether
 * cancellation goes through Apple or Stripe.
 */
export function getPaywallTrustChips(
  platform: PaywallTrustPlatform,
): ReadonlyArray<PaywallTrustChip> {
  return [CANCEL_CHIP_BY_PLATFORM[platform], ...SHARED_TRUST_CHIPS];
}

/**
 * Platform-neutral default. Kept for backwards compatibility with
 * landing surfaces that render before a checkout tier (and therefore
 * before a checkout platform) is selected. Pre-DC4 this was the only
 * export; paywall/pricing surfaces now read `getPaywallTrustChips()`
 * so the cancellation chip is platform-correct.
 */
export const PAYWALL_TRUST_CHIPS: ReadonlyArray<PaywallTrustChip> = [
  {
    label: "Cancel anytime in-app",
    a11yLabel:
      "Cancel anytime in-app. Manage your subscription directly through Apple, Google, or your account settings on web.",
  },
  ...SHARED_TRUST_CHIPS,
] as const;

/**
 * Receipt / post-purchase confirmation copy. Used on the web
 * /checkout/success page and the mobile post-purchase Alert. Lead
 * with cancel-anytime so even users who skim the body see the
 * trust commitment first.
 *
 * Args:
 *   trialEndsLabel — when the trial ends + first charge falls.
 *     Pre-purchase this is "in 7 days from purchase"; post-purchase
 *     surfaces compute the real wall-clock date from the receipt.
 *   cancelPath — platform-specific cancel path
 *     (e.g. "Settings → Subscription on iOS, Settings →
 *     Subscription on web, or Apple/Stripe directly").
 *
 * The composed string contains all four trust elements:
 *   - cancel path (lead)
 *   - trial-end + first charge moment
 *   - refund window + zero-email-needed promise
 *   - support email as a fallback (not as a gate)
 */
/**
 * ENG-1438 (2026-07-05 deep audit, MP-06/LEGAL-006) — condensed one-line
 * auto-renewal disclosure for the ALWAYS-VISIBLE sticky/hero purchase CTA.
 * The full paragraph disclosure (mobile `disclosureText` in
 * `apps/mobile/app/paywall.tsx`, web `BillingDisclosure.tsx`) sits below the
 * fold; the sticky CTA is visible from frame one, so a user could tap
 * purchase without ever scrolling past it. This renders alongside the CTA
 * itself, behind the `paywall_sticky_renewal_line_v1` flag (registered in
 * `REDESIGN_DEFAULT_ON` on both platforms).
 *
 * Legal-reviewed wording (2026-07-17): states all four required elements in
 * one line — it's a trial, it converts to a paid subscription automatically,
 * the price it converts to, and that the user can cancel before it converts
 * (trial branch) — or price + auto-renewal + cancel path (non-trial branch,
 * since only the annual SKU carries a trial, ENG-1285/ENG-1436). Consistent
 * with, and does not replace, the full disclosure paragraph.
 */
export function buildStickyRenewalLine(args: {
  /** True only for the annual SKU — the sole plan carrying a 7-day trial. */
  trialApplies: boolean;
  /** Resolved price string, e.g. "£7.99" (platform's own priceString/SSOT). */
  price: string;
  /** Period suffix including its leading separator, e.g. "/year" or "/month". */
  period: string;
  /** Where the user actually cancels — platform-specific ("Settings" on
   *  mobile, "account settings" on web) so the line never implies a path
   *  that doesn't exist on this platform. */
  cancelSurface: string;
}): string {
  const { trialApplies, price, period, cancelSurface } = args;
  if (trialApplies) {
    return `7-day free trial, then auto-renews at ${price}${period} — cancel before day 7 to avoid charges.`;
  }
  return `${price}${period}, auto-renews until cancelled — cancel anytime in ${cancelSurface}.`;
}

export function buildReceiptTrustCopy(args: {
  trialEndsLabel: string;
  cancelPath: string;
}): string {
  const { trialEndsLabel, cancelPath } = args;
  return (
    `Thanks for joining Pro. ` +
    `Cancel anytime — ${cancelPath}. ` +
    `Your trial ends ${trialEndsLabel}, first charge after that. ` +
    `Refunds within 7 days, no questions asked, ` +
    `email support@getsloe.com if anything's wrong.`
  );
}
