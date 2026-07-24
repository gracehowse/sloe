"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CircleCheck, Target, TrendingDown } from "lucide-react";
import { isFeatureEnabled } from "../../src/lib/analytics/track.ts";
import {
  HERO_CURRENT,
  HERO_HYBRID,
  SLOE_DIFFERENCE_BULLETS,
  SLOE_HOW_IT_WORKS,
  SLOE_TAGLINE,
} from "../../src/lib/landing/sloeLandingContent.ts";
import { LandingFooter, LandingHeader } from "./LandingChrome.tsx";
import { TrendingRail } from "./TrendingRail.tsx";
import {
  DISCOVER_HREF,
  SIGNIN_HREF,
  SIGNUP_CTA_LABEL,
  SIGNUP_HREF,
} from "./landingLinks.ts";
import { Pricing } from "./Pricing.tsx";
import "./landing.css";

// ENG-1441 — both server-read + passed down from `app/page.tsx` (route stays static; see `usePricingRegionNotice.ts`). Both default `false`.
export function LandingPage({ stripeTaxEnabled = false, eurPricingReady = false }: { stripeTaxEnabled?: boolean; eurPricingReady?: boolean }) {
  return (
    <div className="lp-root" id="lp-top">
      <LandingHeader />
      <Hero />
      <TrendingRail />
      <Difference />
      <HowItWorks />
      <CrossDevice />
      <Pricing stripeTaxEnabled={stripeTaxEnabled} eurPricingReady={eurPricingReady} />
      <FinalCta />
      <LandingFooter />
    </div>
  );
}

function Hero() {
  // D-07 (ENG-1204): hybrid positioning leads with the tracker + "what to
  // eat next" coaching promise and demotes the import hook to the wedge
  // line. Gated behind `landing_hero_hybrid_v1` (default ON — see
  // `src/lib/analytics/track.ts`); the recipe-first LEAD stays live in the
  // flag-off path as the kill switch. Both variants now share the settled
  // tagline HEADLINE (`SLOE_TAGLINE`) — see the TAGLINE note in
  // `sloeLandingContent.ts`; only the lead differs.
  const hero = isFeatureEnabled("landing_hero_hybrid_v1") ? HERO_HYBRID : HERO_CURRENT;
  // Design-consistency pass (2026-07-24):
  //  · one filled CTA above the fold — "Browse recipes" drops from an
  //    outlined button (a variant the design system does not have) to ghost;
  //  · the hero's "Already cooking with Sloe? Log in" was the SECOND log-in
  //    entry above the fold, so it goes and the nav one becomes the single
  //    sign-in door (kept visible at phone widths — see landing.css);
  //  · the headline reads in ONE ink. Line 1 was `--foreground-tertiary`
  //    grey — it passes contrast, but grey reads as secondary/disabled while
  //    carrying half the promise. Every other front door (onboarding welcome,
  //    /login, /pricing, the final CTA below) renders this tagline in full
  //    ink with italic "Still" as the only emphasis. Match them.
  const unifiedChrome = isFeatureEnabled("design_consistency_v1");
  return (
    <section className="lp-hero">
      <div className="lp-wrap lp-hero-inner">
        <p className="lp-eyebrow-center">{hero.eyebrow}</p>
        <h1 className={unifiedChrome ? "lp-h-hero lp-h-hero--unified" : "lp-h-hero"}>
          <span className="lp-h-hero-muted">{hero.headline.pre.trim()}</span>
          <br />
          <span className="lp-h-hero-strong">
            <em>{hero.headline.em}</em>
            {hero.headline.post}
          </span>
        </h1>
        <p className="lp-lead-center">{hero.lead}</p>
        <div className="lp-hero-ctas">
          <Link className="lp-btn lp-btn-primary lp-btn-lg" href={SIGNUP_HREF}>
            {unifiedChrome ? SIGNUP_CTA_LABEL : "Get the app"}
          </Link>
          <Link
            className={
              unifiedChrome
                ? "lp-btn lp-btn-ghost lp-btn-lg"
                : "lp-btn lp-btn-outline lp-btn-lg"
            }
            href={DISCOVER_HREF}
          >
            Browse recipes
            <ArrowRight width={16} height={16} aria-hidden />
          </Link>
        </div>
        {unifiedChrome ? null : (
          <p className="lp-hero-login">
            Already cooking with Sloe?{" "}
            <Link href={SIGNIN_HREF} className="lp-link-underline">
              Log in
            </Link>
          </p>
        )}
      </div>
    </section>
  );
}

const DIFFERENCE_ICONS = [Target, CircleCheck, TrendingDown] as const;

function Difference() {
  return (
    <section className="lp-section lp-difference-wrap">
      <div className="lp-wrap">
        <div className="lp-panel lp-difference">
          <div className="lp-difference-copy">
            <p className="lp-eyebrow">The Sloe difference</p>
            <h2 className="lp-h-section">
              Recipe apps ignore your goals.
              <br />
              Diet apps kill the <em>joy</em>.
            </h2>
            <p className="lp-lead">
              Sloe is both. Every recipe shows how it fits your calories and macros — so you can
              have the pasta <em>and</em> hit your targets. We just help it fit.
            </p>
            <ul className="lp-bullet-list">
              {SLOE_DIFFERENCE_BULLETS.map((text, i) => {
                const Icon = DIFFERENCE_ICONS[i] ?? Target;
                return (
                  <li key={text}>
                    <span className="lp-bullet-icon" aria-hidden>
                      <Icon width={17} height={17} />
                    </span>
                    {text}
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="lp-difference-visual" aria-hidden>
            <Image
              className="lp-difference-phone"
              src="/landing/devices/iphone-recipe.png"
              alt=""
              width={470}
              height={980}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="lp-section" id="how">
      <div className="lp-wrap">
        <div className="lp-section-head">
          <h2 className="lp-h-section">
            How Sloe <em>works</em>
          </h2>
          <p className="lp-lead-center">
            From a recipe you spotted to a meal that fits your day — in seconds.
          </p>
        </div>
        <div className="lp-steps-grid">
          {SLOE_HOW_IT_WORKS.map((step) => (
            <div className="lp-step-card" key={step.n}>
              <p className="lp-step-n">{step.n}</p>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CrossDevice() {
  return (
    <section className="lp-section lp-devices-wrap">
      <div className="lp-wrap">
        <div className="lp-panel lp-devices">
          <h2 className="lp-h-section">
            Cook from <em>anywhere</em>
          </h2>
          <p className="lp-lead-center">
            Your recipes, targets and plan stay in sync across desktop, tablet and your phone.
          </p>
          {/* Desktop: MacBook hero centred, iPad front-left, iPhone front-right */}
          <div className="lp-devices-stage" aria-hidden>
            <Image
              className="lp-dev lp-dev-macbook"
              src="/landing/devices/macbook.png"
              alt=""
              width={1480}
              height={980}
              priority={false}
            />
            <Image
              className="lp-dev lp-dev-ipad"
              src="/landing/devices/ipad.png"
              alt=""
              width={760}
              height={1000}
            />
            <Image
              className="lp-dev lp-dev-iphone"
              src="/landing/devices/iphone.png"
              alt=""
              width={470}
              height={980}
            />
          </div>
          {/* Mobile: MacBook + iPhone, cleanly stacked */}
          <div className="lp-devices-mobile" aria-hidden>
            <Image
              className="lp-dev lp-dev-macbook-m"
              src="/landing/devices/macbook.png"
              alt=""
              width={1480}
              height={980}
            />
            <Image
              className="lp-dev lp-dev-iphone-m"
              src="/landing/devices/iphone.png"
              alt=""
              width={470}
              height={980}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  // Same tagline record the hero renders, so the two can never drift apart
  // again — this block used to hard-code the words while the hero read them
  // from a flag-selected variant.
  const unifiedChrome = isFeatureEnabled("design_consistency_v1");
  return (
    <section className="lp-section lp-final-cta">
      <div className="lp-wrap lp-final-cta-inner">
        <h2 className="lp-h-final">
          {SLOE_TAGLINE.pre.trim()}
          <br />
          <em>{SLOE_TAGLINE.em}</em>
          {SLOE_TAGLINE.post}
        </h2>
        <p className="lp-lead-center">
          Join the people fitting the food they love into the life they want.
        </p>
        <Link className="lp-btn lp-btn-primary lp-btn-lg" href={SIGNUP_HREF}>
          {unifiedChrome ? `${SIGNUP_CTA_LABEL} — it's free` : "Get the app — it's free"}
        </Link>
      </div>
    </section>
  );
}
