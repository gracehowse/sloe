"use client";

/**
 * UpgradePaywallDialog — dynamic tier-aware upgrade modal.
 *
 * Originally a Free→Base-only port of the Claude Design 2026-04-20
 * prototype. Extended 2026-04-21 per D12
 * (`docs/decisions/2026-04-21-upgrade-dialog-dynamic-upsell.md`) to
 * render one of two variants based on the caller-supplied `userTier`:
 *
 *  - `userTier === "free"` → Variant A (Free → Base). Existing content,
 *    refined copy per §1 of the decision.
 *  - `userTier === "base"` → Variant B (Base → Pro). New feature set;
 *    primary CTA starts a `tier: "pro"` checkout session. Renewal note
 *    is the legal-safe neutral string — the "You keep Base if you
 *    downgrade" line is FALSE per
 *    `docs/decisions/2026-04-21-pro-downgrade-path.md` and must not
 *    reappear.
 *
 * Pro users should never see this dialog — callers must guard at the
 * open-site. If a Pro user somehow reaches this with `userTier === "pro"`
 * the component renders nothing.
 *
 * Edge case (§3): a Free user who reaches a Pro-gated trigger surface
 * (`voice_log` / `photo_log`) still sees Variant A, with an appended
 * note explaining that Voice/Photo require Pro and Base unlocks the
 * rest. The user must subscribe to Base before Pro is relevant.
 *
 * Frequency cap (§3): one dialog open per session (sessionStorage key
 * `suppr-upsell-dialog-shown-v1`). Explicit intent taps — settings
 * upgrade row, in-surface CTA — bypass the cap via the
 * `bypassSessionCap` prop. The cap does not apply in SSR.
 *
 * Analytics (§5): three new events fire alongside the existing
 * `paywall_viewed` / `paywall_dismissed` / `checkout_started` trio so
 * the legacy funnels stay intact:
 *   - `upsell_variant_shown`     (alongside `paywall_viewed`)
 *   - `upsell_variant_converted` (alongside `checkout_started`)
 *   - `upsell_variant_dismissed` (alongside `paywall_dismissed`)
 * All new emits are StrictMode-guarded via the same `viewedForOpenRef`
 * pattern used for `paywall_viewed`.
 *
 * Prices are read from `PRICING_TIERS` at render time — never
 * hardcoded. Web-only scope; mobile paywall is handled by
 * `apps/mobile/app/paywall.tsx` and is explicitly out of scope for
 * D12.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ShoppingCart,
  ChefHat,
  Link as LinkIcon,
  Infinity as InfinityIcon,
  Camera,
  Mic,
  Zap,
  Mail,
  Sparkles,
  X as XIcon,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "../../../../utils/supabase/info.tsx";
import { AnalyticsEvents, type PaywallViewedFrom } from "../../../lib/analytics/events.ts";
import { track } from "../../../lib/analytics/track.ts";
import { PRICING_TIERS } from "../../../lib/landing/pricingTiers.ts";

const supabaseUrl = `https://${projectId}.supabase.co`;
const supabase = createClient(supabaseUrl, publicAnonKey);

type Feature = {
  icon: LucideIcon;
  title: string;
  description: string;
};

/** Variant A — Free → Base. Icons pinned per D12 §1. */
const VARIANT_A_FEATURES: Feature[] = [
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
    icon: ChefHat,
    title: "Cook mode with timers",
    description: "Step-by-step with inline timers and per-step ingredients.",
  },
  {
    icon: LinkIcon,
    title: "Import from any source",
    description: "Instagram, TikTok, blogs — parsed and matched against USDA in seconds.",
  },
  {
    icon: InfinityIcon,
    title: "Unlimited saved recipes",
    description: "Free tier caps at 10. Base is uncapped.",
  },
];

/** Variant B — Base → Pro. Icons pinned per D12 §1. */
const VARIANT_B_FEATURES: Feature[] = [
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
    icon: Zap,
    title: "Everything in Base",
    description: "Plans, shopping list, cook mode, unlimited recipes — all included.",
  },
  {
    icon: Mail,
    title: "Priority email support",
    description: "Real humans, faster response.",
  },
];

/** sessionStorage key for the once-per-session frequency cap (§3). */
const SESSION_CAP_KEY = "suppr-upsell-dialog-shown-v1";

type Variant = "free_to_base" | "base_to_pro";
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
  const variant: Variant | null =
    userTier === "free"
      ? "free_to_base"
      : userTier === "base"
        ? "base_to_pro"
        : null;

  // Free users who land on a Pro-only trigger surface still get
  // Variant A — Base is the necessary prerequisite — with a short
  // note explaining why. Base users on the same surface get Variant
  // B normally.
  const isProGatedTrigger = from === "voice_log" || from === "photo_log";
  const showProGatedNote = variant === "free_to_base" && isProGatedTrigger;

  // --- Pricing (from SSOT, never hardcoded) -------------------------
  const baseTier = useMemo(() => PRICING_TIERS.find((t) => t.name === "Base"), []);
  const proTier = useMemo(() => PRICING_TIERS.find((t) => t.name === "Pro"), []);

  const isAnnual = period === "annual";

  const baseMonthlyPrice = baseTier?.price ?? "£3.99";
  const baseAnnualPrice = baseTier?.annualPrice ?? "£29.99";
  const basePriceLabel = isAnnual ? baseAnnualPrice : baseMonthlyPrice;
  const basePeriodLabel = isAnnual
    ? (baseTier?.annualPeriod ?? "/year")
    : (baseTier?.period ?? "/month");
  const basePeriodShort = basePeriodLabel.replace(/^\//, "");

  const proMonthlyPrice = proTier?.price ?? "£7.99";
  const proAnnualPrice = proTier?.annualPrice ?? "£59.99";
  const proPriceLabel = isAnnual ? proAnnualPrice : proMonthlyPrice;
  const proPeriodLabel = isAnnual
    ? (proTier?.annualPeriod ?? "/year")
    : (proTier?.period ?? "/month");
  const proPeriodShort = proPeriodLabel.replace(/^\//, "");

  const annualSavingsLabel = baseTier?.annualSavings ?? "Save 37%";

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

    // Legacy `paywall_viewed` — unchanged payload shape, preserves the
    // pre-D12 funnel. `tier` reflects the TARGET tier of the upsell,
    // matching prior usage (Base for Variant A, Pro for Variant B).
    const targetTier: "base" | "pro" = variant === "free_to_base" ? "base" : "pro";
    track(AnalyticsEvents.paywall_viewed, {
      from: from,
      tier: targetTier,
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
      // Map new `secondary_cta` reason back onto the legacy
      // `continue_free` string so pre-D12 dashboards keep working for
      // Variant A. For Variant B the equivalent secondary ("Stay on
      // Base") is a new dismissal path — we reuse `continue_free` on
      // the legacy event as the closest existing slot, but the new
      // event carries the accurate `secondary_cta` reason.
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
    const targetTier: "base" | "pro" = variant === "free_to_base" ? "base" : "pro";
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
        body: JSON.stringify({ tier: targetTier, period }),
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
      track(AnalyticsEvents.checkout_started, { tier: targetTier, period, from });
      // New `upsell_variant_converted` — fires alongside per D12 §5.
      track(AnalyticsEvents.upsell_variant_converted, {
        variant,
        from,
        target_tier: targetTier,
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

  // --- Copy per variant ---------------------------------------------
  const isA = variant === "free_to_base";

  const heroPill = isA ? "Suppr Base" : "Suppr Pro";
  const heroHeadline = isA
    ? "The full meal planning loop"
    : "Log faster. Let the AI do the work.";
  const heroSubtitle = isA
    ? "Plans that hit your macros. Shopping list from your plan. Cook mode with timers."
    : "Snap a photo or say what you ate. Pro handles the rest — no manual entry.";
  const features = isA ? VARIANT_A_FEATURES : VARIANT_B_FEATURES;
  const priceLabel = isA ? basePriceLabel : proPriceLabel;
  const periodLabel = isA ? basePeriodLabel : proPeriodLabel;
  const periodShort = isA ? basePeriodShort : proPeriodShort;
  const cardLabel = isA ? "Base" : "Pro";
  const cardDescriptor = isA
    ? "The full meal planning loop"
    : "Everything in Base, plus AI logging";
  // §1: Variant A carries the "Most popular" badge; Variant B does not.
  const showMostPopular = isA;

  // T24 (full-sweep 2026-04-24): full CMA-aligned disclosure replaces
  // the previous one-line renewal note. Mirrors the mobile paywall
  // string (apps/mobile/app/paywall.tsx ~540) so the highest-intent
  // web surface and the iOS surface make the same commitment to the
  // user. No trial on web upgrade-dialog flow today; if/when added,
  // append the trial-end + first-charge clause from mobile.
  const productName = isA ? "Suppr Base" : "Suppr Pro";
  const periodNoun = isAnnual ? "year" : "month";
  const altLine =
    isAnnual
      ? ` (or ${isA ? baseMonthlyPrice : proMonthlyPrice} per month on the monthly plan)`
      : "";
  // Variant B was LOCKED to a neutral string — the "You keep Base if
  // you downgrade" line is factually wrong per
  // docs/decisions/2026-04-21-pro-downgrade-path.md. Both variants
  // now share the same disclosure shape because both are honest
  // commitments to renewal terms.
  const renewalNote = `${productName} renews automatically at ${priceLabel} per ${periodNoun}${altLine} until cancelled. Cancel anytime from Account → Billing. Prices include any applicable VAT. 7-day refund policy: support@suppr-club.com.`;

  const primaryCtaLabel = isA
    ? `Continue with Base · ${priceLabel}/${periodShort}`
    : `Upgrade to Pro · ${priceLabel}/${periodShort}`;
  const secondaryCtaLabel = isA ? "Continue for free" : "Stay on Base";

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
        <div
          className="relative p-6 pb-7 text-white"
          style={{
            background: "linear-gradient(135deg, var(--primary) 0%, var(--macro-fat, #e04888) 100%)",
          }}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => handleClose("close_button")}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 transition-colors grid place-items-center text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
          >
            <XIcon size={16} />
          </button>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 text-[11px] font-bold tracking-[0.05em] uppercase mb-3">
            <Sparkles size={11} />
            {heroPill}
          </span>
          <h2
            id="upgrade-paywall-title"
            className="text-[24px] md:text-[26px] font-bold -tracking-[0.02em] leading-tight mb-2"
          >
            {heroHeadline}
          </h2>
          <p className="text-[13px] opacity-85 leading-relaxed">{heroSubtitle}</p>
          {showProGatedNote ? (
            // §3 edge case — Free user reaches voice_log / photo_log.
            <p className="mt-2 text-[12px] opacity-95 leading-relaxed font-medium">
              Voice and photo logging require Pro. Base unlocks everything
              else.
            </p>
          ) : null}
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
                  <p className="text-[14px] font-semibold text-foreground leading-snug">
                    {f.title}
                  </p>
                  <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">
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
              className={`flex-1 rounded-lg px-3 py-2 text-[12px] font-semibold transition-colors ${
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
              className={`flex-1 rounded-lg px-3 py-2 text-[12px] font-semibold transition-colors flex items-center justify-center gap-1.5 ${
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
              <p className="text-[12px] text-muted-foreground leading-snug">
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
            className="w-full py-3 rounded-xl bg-primary text-white text-[14px] font-bold hover:opacity-95 disabled:opacity-60 transition-opacity shadow-sm"
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
