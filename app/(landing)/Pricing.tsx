import Link from "next/link";
import { Check } from "lucide-react";
import { PRICING_TIERS } from "../../src/lib/landing/content.ts";
import { PAYWALL_FREE_MFP_WINS_FLAG } from "../../src/lib/landing/content.ts";
import { isFeatureEnabled } from "../../src/lib/analytics/track.ts";
import { LANDING_PRO_FEATURES, landingFreeFeatures } from "../../src/lib/landing/sloeLandingContent.ts";
import { usePricingRegionNotice } from "./usePricingRegionNotice.ts";

// ENG-621 — extracted from LandingPage.tsx (2026-07-21, ENG-1441) to keep
// that screen under its pinned line budget (scripts/screen-line-budget.json).
const SIGNUP_HREF = "/onboarding";

export function Pricing({ stripeTaxEnabled, eurPricingReady }: { stripeTaxEnabled: boolean; eurPricingReady: boolean }) {
  // ENG-1441 (see usePricingRegionNotice.ts) — before the early return: Hooks run unconditionally.
  const { vatNote, regionNote } = usePricingRegionNotice(stripeTaxEnabled, eurPricingReady);

  const free = PRICING_TIERS.find((t) => t.name === "Free");
  const pro = PRICING_TIERS.find((t) => t.name === "Pro");
  if (!free || !pro) return null;

  // ENG-1203 — append the free MFP-switch wins (barcode + custom macros)
  // when the default-on flag is enabled; off → the legacy four bullets.
  const freeFeatures = landingFreeFeatures(
    isFeatureEnabled(PAYWALL_FREE_MFP_WINS_FLAG),
  );

  return (
    <section className="lp-section" id="pricing">
      <div className="lp-wrap lp-pricing-wrap">
        <div className="lp-section-head">
          <h2 className="lp-h-section">
            Start free. Upgrade <em>when you&apos;re ready</em>.
          </h2>
          <p className="lp-lead-center">
            Everything you need to cook and track is free. Pro adds deeper insight and unlimited
            imports.
          </p>
        </div>
        {regionNote ? <p className="lp-region-note" data-testid="landing-pricing-region-note">{regionNote}</p> : null}
        <div className="lp-pricing-grid">
          <div className="lp-price-card">
            <h3>{free.name}</h3>
            <p className="lp-price">
              {free.price}
              <span className="lp-price-sub" />
            </p>
            <Link className="lp-btn lp-btn-outline lp-btn-block" href={SIGNUP_HREF}>
              Get started
            </Link>
            <ul className="lp-price-features">
              {freeFeatures.map((f) => (
                <li key={f}>
                  <Check width={16} height={16} aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <div className="lp-price-card lp-price-card-pro">
            <h3>{pro.name}</h3>
            <p className="lp-price">
              {pro.price}
              <span className="lp-price-sub">
                {pro.period}
                {pro.annualPrice ? ` · or ${pro.annualPrice}${pro.annualPeriod ?? ""}` : ""}
              </span>
            </p>
            {vatNote ? <p className="lp-vat-note" data-testid="landing-pricing-vat-note">{vatNote}</p> : null}
            <Link className="lp-btn lp-btn-primary lp-btn-block" href={SIGNUP_HREF}>
              Get started
            </Link>
            <ul className="lp-price-features">
              {LANDING_PRO_FEATURES.map((f) => (
                <li key={f}>
                  <Check width={16} height={16} aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
