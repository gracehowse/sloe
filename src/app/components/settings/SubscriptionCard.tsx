"use client";

import { useMemo } from "react";
import { Icons } from "../ui/icons";
import { detectRegionFromNavigatorLanguage } from "../../../lib/region/detectRegion";
import { SupprCard } from "../ui/suppr-card";
import { useSubscriptionStatus } from "../../../lib/stripe/useSubscriptionStatus";
import {
  resolveSubscriptionCardView,
  type SubscriptionCardView,
} from "../../../lib/stripe/subscriptionCardView";

/**
 * SubscriptionCard (ENG-748 #11) — the web subscription-management
 * surface. Extracted into its own file rather than grown inside the
 * 1700-line `Settings.tsx` (screen-size rule).
 *
 * Architecture (monetisation-architect): this card NEVER mutates
 * billing state. The Stripe Customer Portal (opened via the existing
 * `/account/billing` shell, fronted by the `CancelExportPromptDialog`)
 * owns every change. The card only DESCRIBES the current state, read
 * from `/api/stripe/subscription-status`.
 *
 * Legal P0s enforced here:
 *   - IAP subscribers (managedVia "app_store") see NO web cancel
 *     control — only the verbatim Apple-billing copy (MV-1/MV-2).
 *   - Cancel reachable in-app via the portal; the cancel/manage CTA
 *     has equal-or-greater visual weight than any keep/upgrade control,
 *     and there is no retention save-wall on the path (CC-1→5).
 *   - Next-charge date/amount/currency are provider-authoritative
 *     (the view helper only formats what Stripe returned) (AR-3/4, PX-1).
 *   - VAT note is flag-gated via resolveRenderedVatNote (PX-2).
 *   - Canceled-but-active reads "cancelled, access until [date]" (AR-7).
 *
 * The render decision is the pure `resolveSubscriptionCardView` helper
 * (unit-tested in `subscriptionCardView.test.ts`); this component is a
 * thin shell over it.
 *
 * `onManageSubscription` is wired by the host (`Settings.tsx`) to fire
 * the existing `CancelExportPromptDialog` → `/account/billing` flow so
 * the export-prompt interstitial behaviour is unchanged.
 *
 * Web-only surface — mobile billing is IAP (RevenueCat / App Store),
 * managed by Apple's own subscription UI, so there is no mobile parity
 * for this card (noted in the ENG-748 report).
 */

export interface SubscriptionCardProps {
  userTier: "free" | "base" | "pro";
  /** Fires the existing cancel-export prompt → /account/billing flow. */
  onManageSubscription: () => void;
}

export function SubscriptionCard({ userTier, onManageSubscription }: SubscriptionCardProps) {
  // Gate the fetch: Free users have nothing to manage. `base` is a
  // legacy internal tier with no active paid entitlement — treat as
  // free for fetch purposes.
  const enabled = userTier === "pro";
  const { loading, error, subscription, managedVia, taxEnabled, canceling } =
    useSubscriptionStatus(enabled);
  // `managedVia` flows into the view helper below (it decides the
  // IAP / none / stripe branch).

  const region = useMemo(() => detectRegionFromNavigatorLanguage(), []);

  const view: SubscriptionCardView = useMemo(
    () =>
      resolveSubscriptionCardView({
        subscription,
        managedVia,
        region,
        taxEnabled,
      }),
    [subscription, managedVia, region, taxEnabled],
  );

  return (
    <SupprCard
      data-testid="subscription-card"
      padding="lg"
      radius="xl"
      className="mb-6"
    >
      <div className="flex items-center gap-2 mb-4">
        <Icons.sparkles className="w-5 h-5 text-muted-foreground" />
        <h3 className="text-foreground">Subscription</h3>
      </div>

      {loading ? (
        <div
          data-testid="subscription-card-loading"
          className="space-y-3"
          aria-busy="true"
        >
          <div className="h-4 w-2/3 rounded bg-skeleton animate-pulse" />
          <div className="h-4 w-1/2 rounded bg-skeleton animate-pulse" />
        </div>
      ) : (
        <SubscriptionCardBody
          view={view}
          error={error}
          canceling={canceling}
          onManageSubscription={onManageSubscription}
        />
      )}
    </SupprCard>
  );
}

function SubscriptionCardBody({
  view,
  error,
  canceling,
  onManageSubscription,
}: {
  view: SubscriptionCardView;
  error: string | null;
  canceling: boolean;
  onManageSubscription: () => void;
}) {
  // IAP — Apple owns billing. NO web cancel control (legal P0 MV-1/2).
  if (view.kind === "iap") {
    return (
      <p
        data-testid="subscription-card-iap"
        className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line"
      >
        {view.body}
      </p>
    );
  }

  // Free / nothing to manage.
  if (view.kind === "none") {
    return (
      <div data-testid="subscription-card-none">
        <p className="text-sm text-muted-foreground mb-3">{view.body}</p>
        <a
          href="/pricing"
          className="inline-flex items-center text-sm font-medium text-success hover:text-success/80"
        >
          View plans
        </a>
      </div>
    );
  }

  // Past-due — amber banner that links STRAIGHT to /account/billing
  // (NO export-dialog interstitial — legal P0). The card still shows
  // the manage button below for completeness, but the banner is the
  // primary, direct path to fix the card.
  if (view.kind === "past_due") {
    return (
      <div data-testid="subscription-card-past-due" className="space-y-4">
        <a
          href="/account/billing"
          data-testid="subscription-card-past-due-banner"
          className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-warning/15 dark:border-warning/50 dark:bg-warning/20 dark:hover:bg-warning/25"
        >
          <Icons.alert className="h-4 w-4 shrink-0" aria-hidden="true" />
          {view.bannerLine}
        </a>
        <CancelReassurance text={view.cancelBlock} vatNote={view.vatNote} />
        {view.paymentMethodLine ? (
          <PaymentMethodLine text={view.paymentMethodLine} />
        ) : null}
        <ManageButton onManageSubscription={onManageSubscription} canceling={canceling} />
      </div>
    );
  }

  // Canceled-but-active — reads "cancelled, access until [date]"
  // (legal P0 AR-7). No keep/upgrade control competes with it.
  if (view.kind === "canceled") {
    return (
      <div data-testid="subscription-card-canceled" className="space-y-4">
        <p className="text-sm leading-relaxed text-foreground whitespace-pre-line">
          {view.statusLine}
        </p>
        {view.paymentMethodLine ? (
          <PaymentMethodLine text={view.paymentMethodLine} />
        ) : null}
        <ManageButton onManageSubscription={onManageSubscription} canceling />
      </div>
    );
  }

  // Active / trial.
  return (
    <div
      data-testid={view.kind === "trial" ? "subscription-card-trial" : "subscription-card-active"}
      className="space-y-4"
    >
      <p className="text-sm leading-relaxed text-foreground whitespace-pre-line">
        {view.statusLine}
      </p>
      {error ? (
        // Soft, non-blocking — the status copy already rendered from
        // whatever Stripe returned; this just notes the refresh hiccup.
        <p
          data-testid="subscription-card-stale-note"
          className="text-xs text-muted-foreground"
        >
          We couldn&rsquo;t refresh your latest billing details just now.
        </p>
      ) : null}
      <CancelReassurance text={view.cancelBlock} vatNote={view.vatNote} />
      {view.paymentMethodLine ? (
        <PaymentMethodLine text={view.paymentMethodLine} />
      ) : null}
      <ManageButton onManageSubscription={onManageSubscription} canceling={canceling} />
    </div>
  );
}

function CancelReassurance({ text, vatNote }: { text: string; vatNote: string }) {
  return (
    <div className="rounded-lg bg-muted/40 px-4 py-3">
      <p
        data-testid="subscription-card-cancel-block"
        className="text-xs leading-relaxed text-muted-foreground"
      >
        {text}
      </p>
      <p
        data-testid="subscription-card-vat-note"
        className="mt-2 text-xs text-muted-foreground"
      >
        {vatNote}
      </p>
    </div>
  );
}

function PaymentMethodLine({ text }: { text: string }) {
  return (
    <p
      data-testid="subscription-card-payment-method"
      className="text-xs text-muted-foreground"
    >
      {text}
    </p>
  );
}

/**
 * The cancel/manage control. Rendered with EQUAL-OR-GREATER visual
 * weight than any keep/upgrade control on the surface (legal P0 CC-5)
 * — it's the primary, full-width, solid-foreground button. Routes
 * through the existing `CancelExportPromptDialog` → /account/billing
 * → Stripe Customer Portal (NO retention save-wall — legal P0 CC-3).
 */
function ManageButton({
  onManageSubscription,
  canceling,
}: {
  onManageSubscription: () => void;
  canceling: boolean;
}) {
  return (
    <button
      type="button"
      data-testid="subscription-card-manage-button"
      onClick={onManageSubscription}
      className="w-full rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {canceling ? "Manage subscription" : "Manage or cancel subscription"}
    </button>
  );
}

export default SubscriptionCard;
