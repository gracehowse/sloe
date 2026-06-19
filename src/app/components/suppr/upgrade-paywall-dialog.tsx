"use client";

/**
 * UpgradePaywallDialog — Free → Pro upgrade modal.
 *
 * History: this dialog originally shipped as a Free→Base-only port of
 * the Claude Design 2026-04-20 prototype. Extended 2026-04-21 per D12
 * (`docs/decisions/2026-04-21-upgrade-dialog-dynamic-upsell.md`) to
 * render two variants (Free→Base + Base→Pro). PR-01 (audit
 * 2026-04-28) collapsed Base out of the SSOT per the 2026-04-27
 * strategic direction; this dialog now renders a single Free→Pro
 * variant. Variant A (Free→Base) and Variant B (Base→Pro) merged into
 * one Pro upsell.
 *
 * Pro users should never see this dialog — callers must guard at the
 * open-site. If a Pro user somehow reaches this with `userTier === "pro"`
 * the component renders nothing. Legacy Base-tier users (any
 * grandfathered `userTier === "base"` row) are treated as Free for
 * upsell purposes — they get the same Pro pitch.
 *
 * Edge case: Free users on a Pro-gated trigger surface (`voice_log`
 * / `photo_log`) get the same Pro upsell — there's no longer a
 * "Base unlocks everything else" intermediate step.
 *
 * Frequency cap: one dialog open per session (sessionStorage key
 * `suppr-upsell-dialog-shown-v2` — bumped from v1 when the variant
 * collapse landed so existing cap markers don't suppress the new
 * Pro-only dialog for returning visitors). Explicit intent taps —
 * settings upgrade row, in-surface CTA — bypass the cap via the
 * `bypassSessionCap` prop. The cap does not apply in SSR.
 *
 * Analytics (§5): three new events fire alongside the existing
 * `paywall_viewed` / `paywall_dismissed` / `checkout_started` trio so
 * the legacy funnels stay intact:
 *   - `upsell_variant_shown`     (alongside `paywall_viewed`)
 *   - `upsell_variant_converted` (alongside `checkout_started`)
 *   - `upsell_variant_dismissed` (alongside `paywall_dismissed`)
 * All new emits carry `variant: "free_to_pro"` after the PR-01
 * collapse. PostHog dashboards that previously sliced on
 * `free_to_base` / `base_to_pro` should be re-anchored at the PR-01
 * commit date.
 *
 * Prices are read from `PRICING_TIERS` at render time — never
 * hardcoded. Web-only scope; mobile paywall is handled by
 * `apps/mobile/app/paywall.tsx`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ShoppingCart,
  Infinity as InfinityIcon,
  Camera,
  Mic,
  Mail,
  Sparkles,
  X as XIcon,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { supabasePublicAnonKey, supabasePublicUrl } from "../../../../utils/supabase/publicConfig.ts";
import { AnalyticsEvents, type PaywallViewedFrom } from "../../../lib/analytics/events.ts";
import { track, isFeatureEnabled } from "../../../lib/analytics/track.ts";
import { PRICING_TIERS } from "../../../lib/landing/pricingTiers.ts";
import { PaywallTrustStrip } from "../../../../app/pricing/PaywallTrustStrip.tsx";

const supabase = createClient(supabasePublicUrl(), supabasePublicAnonKey());

type Feature = {
  icon: LucideIcon;
  title: string;
  description: string;
};

/**
 * Pro upsell features. PR-01 (audit 2026-04-28) collapsed the prior
 * Variant A (Free→Base, "the full meal-planning loop") and Variant B
 * (Base→Pro, "AI logging") into a single feature list because Base
 * was removed from the SSOT. The merged list opens with the
 * highest-intent AI features (the Pro-distinguishing pitch) then
 * carries forward the multi-day plan + shopping list + cook mode +
 * unlimited saves features that used to live under Base. Icons
 * inherited from the per-variant lists.
 */
const PRO_FEATURES: Feature[] = [
  {
    icon: Camera,
    title: "AI photo meal recognition",
    description: "Snap a plate and get verified macros. Up to 100 logs per day.",
  },
  {
    icon: Mic,
    title: "Voice food logging",
    description: 'Say "bowl of oats and a banana" and it\'s logged. Up to 100 per day.',
  },
  {
    icon: CalendarDays,
    title: "Meal plans matched to your macros",
    description: "A week of meals tailored to your targets. Regenerate any day.",
  },
  {
    icon: ShoppingCart,
    title: "Shopping list from your plan",
    description: "Aisle-sorted, quantities combined across recipes.",
  },
  {
    icon: InfinityIcon,
    title: "Unlimited saved recipes",
    description: "Free tier caps at 10. Pro is uncapped.",
  },
  {
    icon: Mail,
    title: "Priority email support",
    description: "Real humans, faster response.",
  },
];

/**
 * sessionStorage key for the once-per-session frequency cap. PR-01
 * (2026-04-28) bumped this from v1 → v2 so any cap markers from the
 * prior Variant-A era don't suppress the new Pro-only dialog for
 * returning visitors.
 */
const SESSION_CAP_KEY = "suppr-upsell-dialog-shown-v2";

/**
 * Single canonical variant after PR-01. Type retained as a string
 * literal so the analytics emits keep their existing event shape;
 * downstream PostHog dashboards see `variant: "free_to_pro"` from the
 * PR-01 commit forward.
 */
type Variant = "free_to_pro";
type UpsellUserTier = "free" | "base";

export interface UpgradePaywallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Canonical `from` surface attribution for analytics. */
  from: PaywallViewedFrom;
  /**
   * Current user's tier — wired from the app-level `AppDataContext`
   * at the call site in `src/app/App.tsx`. The dialog never fetches
   * tier itself (per D12 blocking item §6.3 — no loading spinner on
   * an intent-driven modal). Pro users must be guarded at the
   * open-site; if `userTier === "pro"` the component renders nothing.
   */
  userTier: "free" | "base" | "pro";
  /**
   * When true, bypass the once-per-session frequency cap. Use for
   * explicit intent taps (settings upgrade row, in-surface CTAs)
   * where the user clearly wants to re-engage. Defaults to `false`.
   */
  bypassSessionCap?: boolean;
}

/**
 * Consult the sessionStorage cap. Returns `true` if the dialog has
 * already been shown this session (and should be suppressed unless
 * `bypassSessionCap` is true). SSR-safe — returns `false` when
 * `window` is unavailable.
 */
function hasShownThisSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(SESSION_CAP_KEY) === "1";
  } catch {
    // sessionStorage can throw in private browsing modes; fail open
    // (show the dialog) rather than lock the user out.
    return false;
  }
}

function markShownThisSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SESSION_CAP_KEY, "1");
  } catch {
    // Swallow — the cap is a nice-to-have, not a correctness gate.
  }
}

export function UpgradePaywallDialog({
  open,
  onOpenChange,
  from,
  userTier,
  bypassSessionCap = false,
}: UpgradePaywallDialogProps) {
  const [busy, setBusy] = useState(false);
  // T24 (full-sweep 2026-04-24): the highest-intent purchase surface
  // (this dialog) was hardcoded to monthly, so a user converting from
  // here always paid ~60% more per year vs. annual. Default monthly
  // matches the /pricing default but the user can flip to annual
  // before checkout — no second-screen trip required.
  const [period, setPeriod] = useState<"monthly" | "annual">("monthly");

  // --- Variant selection --------------------------------------------
  // PR-01 (audit 2026-04-28): single Free→Pro variant. Pro users
  // render nothing (guard at line ~340). Any legacy `userTier ===
  // "base"` row is treated as Free-equivalent for upsell purposes —
  // they get the same Pro pitch.
  const variant: Variant | null = userTier === "pro" ? null : "free_to_pro";

  // --- Pricing (from SSOT, never hardcoded) -------------------------
  const proTier = useMemo(() => PRICING_TIERS.find((t) => t.name === "Pro"), []);

  const isAnnual = period === "annual";

  const proMonthlyPrice = proTier?.price ?? "£7.99";
  const proAnnualPrice = proTier?.annualPrice ?? "£59.99";
  const proPriceLabel = isAnnual ? proAnnualPrice : proMonthlyPrice;
  const proPeriodLabel = isAnnual
    ? (proTier?.annualPeriod ?? "/year")
    : (proTier?.period ?? "/month");
  const proPeriodShort = proPeriodLabel.replace(/^\//, "");

  const annualSavingsLabel = proTier?.annualSavings ?? "Save 37%";

  // --- StrictMode double-fire guard (shared across new + legacy emits) ---
  const viewedForOpenRef = useRef(false);
  // Suppress double-fire when the secondary CTA triggers close.
  const dismissReasonRef = useRef<
    "secondary_cta" | "close_button" | "backdrop" | null
  >(null);

  // --- Session cap: mark shown on first open --------------------------
  // We record the session-shown marker only once per mount-open, AFTER
  // the viewed-guard has decided to actually render. Pro users (no
  // variant) do not mark the cap.
  useEffect(() => {
    if (!open) {
      viewedForOpenRef.current = false;
      return;
    }
    if (viewedForOpenRef.current) return;
    if (!variant) return; // Pro users — do not emit
    viewedForOpenRef.current = true;

    // Legacy `paywall_viewed` — unchanged payload shape, preserves
    // the pre-D12 funnel. PR-01 (2026-04-28) collapsed `tier` to
    // always "pro"; Base is gone from the SSOT.
    track(AnalyticsEvents.paywall_viewed, {
      from: from,
      tier: "pro",
      surface: "upgrade_dialog",
      platform: "web",
    });

    // New `upsell_variant_shown` — fires alongside, per D12 §5.
    track(AnalyticsEvents.upsell_variant_shown, {
      variant,
      from,
      surface: "upgrade_dialog",
      platform: "web",
      user_tier: userTier as UpsellUserTier,
    });

    // Mark the session cap so a subsequent automatic open this session
    // can no-op. Manual intent taps pass `bypassSessionCap` at the
    // render site.
    markShownThisSession();
  }, [open, from, variant, userTier]);

  const emitDismiss = useCallback(
    (reason: "secondary_cta" | "close_button" | "backdrop") => {
      if (!variant) return;
      // Map `secondary_cta` reason onto the legacy `continue_free`
      // string so pre-D12 dashboards keep working. Single Pro upsell
      // post-PR-01 (2026-04-28) — the secondary CTA reads "Continue
      // for free" again.
      const legacyReason: "continue_free" | "close_button" | "backdrop" =
        reason === "secondary_cta" ? "continue_free" : reason;
      track(AnalyticsEvents.paywall_dismissed, { from, reason: legacyReason });
      track(AnalyticsEvents.upsell_variant_dismissed, {
        variant,
        from,
        reason,
        surface: "upgrade_dialog",
        platform: "web",
        user_tier: userTier as UpsellUserTier,
      });
    },
    [from, variant, userTier],
  );

  const handleClose = useCallback(
    (reason: "secondary_cta" | "close_button" | "backdrop") => {
      dismissReasonRef.current = reason === "backdrop" ? null : reason;
      emitDismiss(reason);
      onOpenChange(false);
    },
    [emitDismiss, onOpenChange],
  );

  // Escape key → treat as backdrop dismiss.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (dismissReasonRef.current != null) {
          dismissReasonRef.current = null;
          return;
        }
        emitDismiss("backdrop");
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, emitDismiss, onOpenChange]);

  const handleStartCheckout = useCallback(async () => {
    if (busy || !variant) return;
    setBusy(true);
    // PR-01 (2026-04-28): single Pro target. The Variant A path that
    // started a `tier: "base"` checkout is gone — Base price IDs are
    // archived in Stripe + RevenueCat (operational follow-up).
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        // Not logged in — send to login with return URL preserving the
        // pricing origin so the user resumes at /pricing post-auth.
        window.location.href = `/login?redirect=/pricing?from=${from}`;
        return;
      }

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tier: "pro", period }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        url?: string;
        message?: string;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.url) {
        alert(data.message ?? data.error ?? "Checkout is unavailable right now. Please try again.");
        return;
      }
      // Legacy `checkout_started` — unchanged shape.
      track(AnalyticsEvents.checkout_started, { tier: "pro", period, from });
      // New `upsell_variant_converted` — always `free_to_pro` post-PR-01.
      track(AnalyticsEvents.upsell_variant_converted, {
        variant,
        from,
        target_tier: "pro",
        period,
        surface: "upgrade_dialog",
        platform: "web",
        user_tier: userTier as UpsellUserTier,
      });
      window.location.href = data.url;
    } catch {
      alert("Could not start checkout. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [busy, from, variant, userTier, period]);

  // Pro users, or anyone hitting the session cap without explicit
  // bypass, render nothing. We do the cap check at render time (not in
  // the open-effect) so the dialog never momentarily flashes before
  // closing itself.
  if (!open) return null;
  if (!variant) return null; // Pro — guard
  if (!bypassSessionCap && hasShownThisSession() && !viewedForOpenRef.current) {
    // Only suppress if this is a fresh open we haven't already marked.
    return null;
  }

  // --- Copy ---------------------------------------------------------
  // PR-01 (audit 2026-04-28): single Pro pitch. The earlier two-
  // variant logic is gone; if you're seeing this dialog, you're being
  // shown the Pro upsell.
  const heroPill = "Pro";
  const heroHeadline = "Log faster. Let the AI do the work.";
  const heroSubtitle =
    "Snap a photo or say what you ate. Pro handles the rest — and unlocks the full meal-planning loop.";
  const features = PRO_FEATURES;
  const priceLabel = proPriceLabel;
  const periodLabel = proPeriodLabel;
  const periodShort = proPeriodShort;
  const cardLabel = "Pro";
  const cardDescriptor = "Everything in Free, plus AI logging";
  const showMostPopular = true;

  // T24 (full-sweep 2026-04-24): full CMA-aligned disclosure. Mirrors
  // the mobile paywall string (apps/mobile/app/paywall.tsx ~540) so
  // the highest-intent web surface and the iOS surface make the same
  // commitment to the user. No trial on web upgrade-dialog flow
  // today; if/when added, append the trial-end + first-charge clause
  // from mobile.
  const productName = "Pro";
  const periodNoun = isAnnual ? "year" : "month";
  const altLine = isAnnual
    ? ` (or ${proMonthlyPrice} per month on the monthly plan)`
    : "";
  const renewalNote = `${productName} renews automatically at ${priceLabel} per ${periodNoun}${altLine} until cancelled. Cancel anytime from Account → Billing. Prices include any applicable VAT. 7-day refund policy: support@suppr-club.com.`;

  const primaryCtaLabel = `Upgrade to Pro · ${priceLabel}/${periodShort}`;
  const secondaryCtaLabel = "Continue for free";
  const sloeHero = isFeatureEnabled("paywall_upgrade_dialog_sloe_v1");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-paywall-title"
      className="fixed inset-0 z-[60] grid place-items-center bg-black/55 p-4 overflow-y-auto"
      onClick={() => handleClose("backdrop")}
    >
      <div
        className="relative w-full max-w-lg max-h-[92vh] overflow-hidden rounded-2xl bg-background border border-border shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hero */}
        <div className="relative p-6 pb-7 border-b border-border bg-card text-foreground">
          <button
            type="button"
            aria-label="Close"
            onClick={() => handleClose("close_button")}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-muted hover:bg-muted/80 transition-colors grid place-items-center text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <XIcon size={16} />
          </button>
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
                Snap a photo or say what you ate — Pro handles the rest, and unlocks unlimited imports and macro fitting.
              </p>
            </>
          ) : (
            <>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-[0.05em] uppercase mb-3">
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
        </div>

        {/* Scrollable feature + price body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Features */}
          <ul>
            {features.map((f) => (
              <li
                key={f.title}
                className="flex gap-3.5 py-3 border-b border-border last:border-b-0"
              >
                <span
                  aria-hidden
                  className="shrink-0 w-9 h-9 rounded-[10px] grid place-items-center"
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
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                    {f.description}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          {/* T24: monthly / annual toggle — matches the /pricing toggle
              pattern so a user converting from inside the product can
              pick annual without leaving the dialog. */}
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
                  ? "bg-primary/15 text-primary"
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
              className={`flex-1 rounded-lg px-3 py-2 text-[11px] font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                isAnnual
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Annual
              <span
                className="px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[9px] font-bold uppercase tracking-wide"
                aria-hidden
              >
                {annualSavingsLabel}
              </span>
            </button>
          </div>

          {/* Pricing card */}
          <div className="mt-3 rounded-2xl border-2 border-primary bg-card p-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[15px] font-bold text-foreground">
                  {cardLabel}
                </span>
                {showMostPopular ? (
                  <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold uppercase tracking-wide">
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
        </div>

        {/* Footer — renewal note pinned above CTAs so it is visible
            without scrolling on the 320×600 reference viewport per §4
            item 4. The scrollable body above absorbs overflow; the
            footer stays fixed. */}
        <div className="border-t border-border px-5 pt-3 pb-5 flex flex-col gap-1.5">
          <PaywallTrustStrip />
          <p
            data-testid="upsell-renewal-note"
            className="text-[11px] text-muted-foreground text-center leading-snug mb-1"
          >
            {renewalNote}
          </p>
          <button
            type="button"
            onClick={handleStartCheckout}
            disabled={busy}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-[13px] font-bold hover:opacity-95 disabled:opacity-60 transition-opacity shadow-sm"
          >
            {busy ? "Opening checkout..." : primaryCtaLabel}
          </button>
          <button
            type="button"
            onClick={() => handleClose("secondary_cta")}
            className="w-full py-2.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {secondaryCtaLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default UpgradePaywallDialog;
