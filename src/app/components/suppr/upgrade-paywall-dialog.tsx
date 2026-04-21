"use client";

/**
 * UpgradePaywallDialog — Claude Design 2026-04-20 prototype port of the
 * whole-paywall modal (see
 * `docs/ux/claude-design-bundles/prototype/project/flows.jsx` →
 * `Paywall`). Replaces the old in-app "tap Upgrade → navigate to
 * /pricing" flow for desktop-web surfaces: the dialog now handles the
 * primary pitch + Stripe checkout start inline, and the /pricing route
 * stays as the shareable public surface.
 *
 * Structure:
 *  - Gradient hero header (primary → magenta) with a `SUPPR BASE` pill
 *    overline, the "The full meal planning loop" title, subtitle, and
 *    a top-right close X.
 *  - Five feature rows separated by borders. Each row has a 36×36
 *    primary-tinted icon-box + title + description.
 *  - A single "Base · Most popular" pricing card showing the real price
 *    sourced from `PRICING_TIERS` (`src/lib/landing/pricingTiers.ts`).
 *    The prototype hardcoded `$5/month`; we honour CLAUDE.md's
 *    region-aware pricing rule by reading the live tier (£3.99 in the
 *    UK, USD in the US via the pricing SSOT). `from` attribution
 *    rides through `paywall_viewed`.
 *  - Primary CTA "Continue with Base · {price}" that starts the real
 *    Stripe checkout (same call the `/pricing` page uses — shared
 *    lifted-out `startCheckout` helper).
 *  - Secondary "Continue for free" link that fires the `dismissed`
 *    event + closes the dialog.
 *
 * Analytics shape (mirrors AiPaywallDialog):
 *  - `paywall_viewed { from, tier: "base", surface: "upgrade_dialog",
 *     platform: "web" }` — on mount (guarded against StrictMode double-
 *     fire).
 *  - `paywall_dismissed { from, reason }` — on every close path.
 *    `reason` is one of `"continue_free" | "close_button" | "backdrop"`.
 *  - `checkout_started { tier: "base", period, from }` — when the
 *    primary CTA is tapped (mirrors `CheckoutButton`).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ShoppingCart,
  ChefHat,
  Link as LinkIcon,
  Infinity as InfinityIcon,
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

const FEATURES: Feature[] = [
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
    description: "Instagram, TikTok, blogs. 7-second parse, USDA-verified.",
  },
  {
    icon: InfinityIcon,
    title: "Unlimited saved recipes",
    description: "Free tier caps at 10. Base is uncapped.",
  },
];

export interface UpgradePaywallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Canonical `from` surface attribution for analytics. */
  from: PaywallViewedFrom;
}

export function UpgradePaywallDialog({ open, onOpenChange, from }: UpgradePaywallDialogProps) {
  const [busy, setBusy] = useState(false);
  // Period is monthly on this surface — the prototype's pitch is a
  // simple "Continue with Base · $5/mo" CTA. Annual toggle stays on
  // `/pricing` where the comparison table lives.
  const period: "monthly" = "monthly";

  const baseTier = useMemo(() => PRICING_TIERS.find((t) => t.name === "Base"), []);
  const priceLabel = baseTier?.price ?? "£3.99";
  const periodLabel = baseTier?.period ?? "/month";
  // Short form used in the CTA button: "£3.99/mo" (strip the leading slash).
  const periodShort = periodLabel.replace(/^\//, "");
  const ctaLabel = `Continue with Base · ${priceLabel}/${periodShort}`;

  // StrictMode double-fire guard on `paywall_viewed` — same pattern as
  // `ai-paywall-dialog.tsx`.
  const viewedForOpenRef = useRef(false);
  // Suppress the double-fire when the user taps the explicit "Continue
  // for free" button (which triggers close).
  const dismissReasonRef = useRef<"continue_free" | "close_button" | null>(null);

  useEffect(() => {
    if (!open) {
      viewedForOpenRef.current = false;
      return;
    }
    if (viewedForOpenRef.current) return;
    viewedForOpenRef.current = true;
    track(AnalyticsEvents.paywall_viewed, {
      from: from,
      tier: "base",
      surface: "upgrade_dialog",
      platform: "web",
    });
  }, [open, from]);

  const emitDismiss = useCallback(
    (reason: "continue_free" | "close_button" | "backdrop") => {
      track(AnalyticsEvents.paywall_dismissed, { from, reason });
    },
    [from],
  );

  const handleClose = useCallback(
    (reason: "continue_free" | "close_button" | "backdrop") => {
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
        // Avoid double-fire when the explicit buttons already handled it.
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
    if (busy) return;
    setBusy(true);
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
        body: JSON.stringify({ tier: "base", period }),
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
      track(AnalyticsEvents.checkout_started, { tier: "base", period, from });
      window.location.href = data.url;
    } catch {
      alert("Could not start checkout. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [busy, from]);

  if (!open) return null;

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
            Suppr Base
          </span>
          <h2
            id="upgrade-paywall-title"
            className="text-[24px] md:text-[26px] font-bold -tracking-[0.02em] leading-tight mb-2"
          >
            The full meal planning loop
          </h2>
          <p className="text-[13px] opacity-85 leading-relaxed">
            Plans that hit your macros, one-tap shopping lists, cook mode with timers.
          </p>
        </div>

        {/* Scrollable feature + price body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Features */}
          <ul>
            {FEATURES.map((f) => (
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

          {/* Pricing card */}
          <div className="mt-5 rounded-2xl border-2 border-primary bg-card p-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[15px] font-bold text-foreground">Base</span>
                <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold uppercase tracking-wide">
                  Most popular
                </span>
              </div>
              <p className="text-[12px] text-muted-foreground leading-snug">
                The full meal planning loop
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

        {/* Footer CTAs */}
        <div className="border-t border-border px-5 pt-4 pb-5 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={handleStartCheckout}
            disabled={busy}
            className="w-full py-3 rounded-xl bg-primary text-white text-[14px] font-bold hover:opacity-95 disabled:opacity-60 transition-opacity shadow-sm"
          >
            {busy ? "Opening checkout..." : ctaLabel}
          </button>
          <button
            type="button"
            onClick={() => handleClose("continue_free")}
            className="w-full py-2.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Continue for free
          </button>
        </div>
      </div>
    </div>
  );
}

export default UpgradePaywallDialog;
