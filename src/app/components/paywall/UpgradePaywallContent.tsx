"use client";

/**
 * ENG-1459 — the Free→Pro upsell's sell content (hero, features, period
 * toggle, pricing card, trial-reminder day-picker, trust strip, CMA
 * renewal disclosure, primary + secondary CTA). The copy/pricing/disclosure
 * logic is a deliberate, careful re-derivation of
 * `upgrade-paywall-dialog.tsx:375-563` — same SSOT imports
 * (`PRICING_TIERS`, `UPGRADE_PAYWALL_PRO_FEATURES`,
 * `useUpgradeDialogTaxClause`), same copy, same disclosure template —
 * used inline in the onboarding terminal step's merged screen (flag
 * `onboarding_upgrade_inline_paywall_v1`, `src/app/components/
 * onboarding/steps/upgrade.tsx`), with NO modal chrome at all.
 *
 * DELIBERATELY NOT wired into `UpgradePaywallDialog` in this change.
 * The dialog is mounted from exactly one JSX call site
 * (`src/app/App.tsx`) but that one site fans out to every non-onboarding
 * upsell trigger across the app (settings, voice_log, photo_log,
 * meal_planner, recipe_import, …) — a single-pass refactor of its
 * hero/scroll-region/footer chrome carries real regression risk to all
 * of those triggers at once, with no human review before push. Rather
 * than gamble a revenue-critical, multi-trigger surface on a mechanical
 * "thin wrapper" refactor, this ships as new, additive, independently
 * tested code that changes ZERO bytes of `upgrade-paywall-dialog.tsx`.
 * `useUpgradePaywallCheckout` is written so a future, reviewed follow-up
 * *could* migrate the dialog onto this same content component — that
 * migration is intentionally out of scope here.
 *
 * Every legal/compliance element this content owns is unchanged from
 * the dialog it mirrors — see the ENG-1459 preservation checklist:
 *   - C4 skip affordance ("Continue for free") — always visible, never
 *     disabled/scroll-gated.
 *   - C2 "trial" wording only on the annual (trial-eligible) SKU.
 *   - C1/C8 VAT gate (`useUpgradeDialogTaxClause`) + trust strip.
 *   - C5 no confirmshaming/urgency/pre-ticked trial.
 *   - C10 analytics honesty — dismiss tracking on the secondary CTA,
 *     checkout tracking via `useUpgradePaywallCheckout` (which also
 *     owns `checkout_started`/`upsell_variant_converted`).
 *   - CMA six-element auto-renewal disclosure, pinned above the CTAs.
 *   - "estimated macros", never "verified macros" (C6-adjacent).
 *   - Pro-guard (`if (!variant) return null`) — enforced here so every
 *     caller gets it for free, not just the modal.
 *   - Prices always read from `PRICING_TIERS`, never hardcoded.
 */
import { useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { AnalyticsEvents, type PaywallViewedFrom } from "../../../lib/analytics/events.ts";
import { track, isFeatureEnabled } from "../../../lib/analytics/track.ts";
import { PRICING_TIERS } from "../../../lib/landing/pricingTiers.ts";
import { useUpgradeDialogTaxClause } from "../suppr/useUpgradeDialogTaxClause.ts";
import { PaywallTrustStrip } from "../../../../app/pricing/PaywallTrustStrip.tsx";
import { TrialEndReminderUpgradeBlock, type TrialEndReminderUpgradeBlockHandle } from "./TrialEndReminderUpgradeBlock.tsx";
import { UPGRADE_PAYWALL_PRO_FEATURES } from "./upgradePaywallProFeatures.ts";
import { useUpgradePaywallCheckout, type UpgradePaywallVariant, type UpsellUserTier } from "./useUpgradePaywallCheckout.ts";

export interface UpgradePaywallContentProps {
  /** Canonical `from` surface attribution for analytics. */
  from: PaywallViewedFrom;
  userTier: "free" | "base" | "pro";
  /** Billing period the toggle starts on. See `UpgradePaywallDialogProps.defaultPeriod`. */
  defaultPeriod?: "monthly" | "annual";
  /** Fires when the "Continue for free" secondary CTA is tapped — AFTER
   *  this component's own dismiss analytics (`paywall_dismissed` +
   *  `upsell_variant_dismissed`, reason `continue_free`/`secondary_cta`)
   *  have already fired, so every caller gets honest dismiss tracking
   *  without re-implementing it. */
  onSecondaryCta: () => void;
  /** `surface` tag threaded onto `upsell_variant_shown`/`_dismissed`/
   *  `_converted` so PostHog can tell this inline surface apart from the
   *  `UpgradePaywallDialog` modal's `"upgrade_dialog"` (C10 — don't
   *  misreport where a conversion happened). Defaults to
   *  `"onboarding_inline"`, the only current caller. */
  surface?: string;
  /** Fires synchronously the moment the primary (Upgrade) CTA is tapped,
   *  before checkout starts — lets a caller record its own intent
   *  tracking (e.g. the onboarding step's `onboarding_trial_choice`)
   *  without this component knowing about onboarding-specific state. */
  onPrimaryCtaIntent?: () => void;
}

export function UpgradePaywallContent({
  from,
  userTier,
  defaultPeriod = "monthly",
  onSecondaryCta,
  surface = "onboarding_inline",
  onPrimaryCtaIntent,
}: UpgradePaywallContentProps) {
  // --- Variant selection — single Free→Pro variant post-PR-01. Pro users
  // render nothing (guard below).
  const variant: UpgradePaywallVariant | null = userTier === "pro" ? null : "free_to_pro";
  const userTierForAnalytics = userTier as UpsellUserTier;

  const [period, setPeriod] = useState<"monthly" | "annual">(defaultPeriod);
  const isAnnual = period === "annual";
  const trialReminderRef = useRef<TrialEndReminderUpgradeBlockHandle>(null);

  const { busy, handleStartCheckout } = useUpgradePaywallCheckout({
    from,
    userTier,
    period,
    variant,
    surface,
    trialReminderRef,
  });

  // --- Pricing (from SSOT, never hardcoded) -------------------------
  const proTier = useMemo(() => PRICING_TIERS.find((t) => t.name === "Pro"), []);

  const proMonthlyPrice = proTier?.price ?? "£7.99";
  const proAnnualPrice = proTier?.annualPrice ?? "£59.99";
  const proPriceLabel = isAnnual ? proAnnualPrice : proMonthlyPrice;
  const proPeriodLabel = isAnnual
    ? (proTier?.annualPeriod ?? "/year")
    : (proTier?.period ?? "/month");
  const proPeriodShort = proPeriodLabel.replace(/^\//, "");

  const annualSavingsLabel = proTier?.annualSavings ?? "Save 37%";
  const taxClause = useUpgradeDialogTaxClause(); // ENG-1441

  const handleSecondaryCta = () => {
    if (!variant) return;
    // Legacy `paywall_dismissed` — unchanged payload shape.
    track(AnalyticsEvents.paywall_dismissed, { from, reason: "continue_free" });
    // `upsell_variant_dismissed` — fires alongside, per D12 §5.
    track(AnalyticsEvents.upsell_variant_dismissed, {
      variant,
      from,
      reason: "secondary_cta",
      surface,
      platform: "web",
      user_tier: userTierForAnalytics,
    });
    onSecondaryCta();
  };

  const handlePrimaryCta = () => {
    onPrimaryCtaIntent?.();
    void handleStartCheckout();
  };

  // Pro users render nothing — no next tier to pitch.
  if (!variant) return null;

  // --- Copy -----------------------------------------------------------
  const heroPill = "Pro";
  const heroHeadline = "Log faster. Let the AI do the work.";
  const heroSubtitle =
    "Snap a photo or say what you ate. Pro handles the rest — and unlocks the full meal-planning loop.";
  const features = UPGRADE_PAYWALL_PRO_FEATURES;
  const priceLabel = proPriceLabel;
  const periodLabel = proPeriodLabel;
  const periodShort = proPeriodShort;
  const cardLabel = "Pro";
  const cardDescriptor = "Everything in Free, plus AI logging";
  const showMostPopular = true;

  // T24 (2026-04-24): CMA-aligned disclosure mirroring the mobile paywall
  // string (apps/mobile/app/paywall.tsx ~540). ENG-1285: annual leads with
  // the real 7-day Stripe trial + Day-7 first charge; monthly unchanged.
  const productName = "Pro";
  const periodNoun = isAnnual ? "year" : "month";
  const altLine = isAnnual
    ? ` (or ${proMonthlyPrice} per month on the monthly plan)`
    : "";
  const trialLead = isAnnual
    ? "Starts with a 7-day free trial — no payment due today, first charge on Day 7. "
    : "";
  const renewalNote = `${trialLead}${productName} renews automatically at ${priceLabel} per ${periodNoun}${altLine} until cancelled. Cancel anytime from Account → Billing. ${taxClause} 7-day refund policy: support@getsloe.com.`;

  const primaryCtaLabel = `Upgrade to Pro · ${priceLabel}/${periodShort}`;
  const secondaryCtaLabel = "Continue for free";
  const sloeHero = isFeatureEnabled("paywall_upgrade_dialog_sloe_v1");

  return (
    <>
      {/* Hero */}
      {sloeHero ? (
        <>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--accent-primary-solid)] mb-2">
            Sloe Pro
          </p>
          <h2
            id="upgrade-paywall-title"
            className="text-[24px] md:text-[28px] font-medium font-[family-name:var(--font-newsreader)] tracking-tight leading-[1.12] mb-2 text-foreground-brand"
          >
            Cook what you love.{" "}
            <em className="italic">Still</em> reach your goals.
          </h2>
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            Snap a photo or say what you ate — Pro handles the rest, and unlocks unlimited saves and macro fitting.
          </p>
        </>
      ) : (
        <>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary-soft text-primary-solid text-[11px] font-bold tracking-[0.05em] uppercase mb-3">
            <Sparkles size={11} />
            {heroPill}
          </span>
          <h2
            id="upgrade-paywall-title"
            className="text-[24px] md:text-[28px] font-bold -tracking-[0.02em] leading-tight mb-2"
          >
            {heroHeadline}
          </h2>
          <p className="text-[13px] text-muted-foreground leading-relaxed">{heroSubtitle}</p>
        </>
      )}

      {/* Features */}
      <ul className="mt-4">
        {features.map((f) => (
          <li
            key={f.title}
            className="flex gap-3 py-3 border-b border-border last:border-b-0"
          >
            <span
              aria-hidden
              className="shrink-0 w-9 h-9 rounded-full grid place-items-center"
              style={{
                background: "color-mix(in oklab, var(--primary) 15%, transparent)",
                color: "var(--primary)",
              }}
            >
              <f.icon size={18} strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-foreground leading-snug">
                {f.title}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0 leading-relaxed">
                {f.description}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {/* T24: monthly / annual toggle */}
      <div
        className="mt-5 inline-flex w-full rounded-xl border border-border bg-card p-1"
        role="tablist"
        aria-label="Billing period"
        data-testid="upsell-period-toggle"
      >
        <button
          type="button"
          role="tab"
          aria-selected={!isAnnual}
          data-testid="upsell-period-monthly"
          onClick={() => setPeriod("monthly")}
          className={`flex-1 rounded-lg px-3 py-2 text-[11px] font-semibold transition-colors ${
            !isAnnual
              ? "bg-primary-soft text-primary-solid"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Monthly
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={isAnnual}
          data-testid="upsell-period-annual"
          onClick={() => setPeriod("annual")}
          className={`flex-1 rounded-lg px-3 py-2 text-[11px] font-semibold transition-colors flex items-center justify-center gap-1 ${
            isAnnual
              ? "bg-primary-soft text-primary-solid"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Annual
          <span
            className="px-1 py-0 rounded-full bg-primary-soft text-primary-solid text-[9px] font-bold uppercase tracking-wide"
            aria-hidden
          >
            {annualSavingsLabel}
          </span>
        </button>
      </div>

      {/* Pricing card */}
      <div className="mt-3 rounded-[12px] border-2 border-primary bg-card p-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[15px] font-bold text-foreground">
              {cardLabel}
            </span>
            {showMostPopular ? (
              <span className="px-2 py-0 rounded-full bg-primary-soft text-primary-solid text-[10px] font-bold uppercase tracking-wide">
                Most popular
              </span>
            ) : null}
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug">
            {cardDescriptor}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[22px] font-extrabold tabular-nums text-foreground -tracking-[0.02em] leading-none">
            {priceLabel}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">{periodLabel}</p>
        </div>
      </div>

      <TrialEndReminderUpgradeBlock ref={trialReminderRef} isAnnual={isAnnual} />

      {/* Footer — renewal note pinned above CTAs so it is visible without
          scrolling on the 320×600 reference viewport per §4 item 4. */}
      <div className="mt-4 flex flex-col gap-1">
        <PaywallTrustStrip />
        <p
          data-testid="upsell-renewal-note"
          className="text-[11px] text-muted-foreground text-center leading-snug mb-1"
        >
          {renewalNote}
        </p>
        <button
          type="button"
          onClick={handlePrimaryCta}
          disabled={busy}
          className="w-full py-3 rounded-full bg-primary text-primary-foreground text-base font-bold hover:opacity-95 disabled:opacity-60 transition-opacity shadow-sm"
        >
          {busy ? "Opening checkout..." : primaryCtaLabel}
        </button>
        <button
          type="button"
          onClick={handleSecondaryCta}
          className="w-full py-2 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          {secondaryCtaLabel}
        </button>
      </div>
    </>
  );
}

export default UpgradePaywallContent;
