"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import {
  ArrowRight,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Laptop,
  Moon,
  Sun,
  Target,
  TrendingDown,
} from "lucide-react";
import { PRICING_TIERS } from "../../src/lib/landing/content.ts";
import { PAYWALL_FREE_MFP_WINS_FLAG } from "../../src/lib/landing/content.ts";
import { isFeatureEnabled } from "../../src/lib/analytics/track.ts";
import {
  HERO_CURRENT,
  HERO_HYBRID,
  LANDING_PRO_FEATURES,
  SLOE_DIFFERENCE_BULLETS,
  SLOE_HOW_IT_WORKS,
  TRENDING_RECIPES,
  landingFreeFeatures,
} from "../../src/lib/landing/sloeLandingContent.ts";
import { FatSecretBadge } from "../../src/app/components/ui/FatSecretBadge";
import "./landing.css";

const NAV_LINKS = [
  { href: "/discover", label: "Recipes" },
  { href: "#how", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
] as const;

const SIGNUP_HREF = "/onboarding";
const SIGNIN_HREF = "/login";
const DISCOVER_HREF = "/discover";

export function LandingPage() {
  return (
    <div className="lp-root" id="lp-top">
      <LandingHeader />
      <Hero />
      <Trending />
      <Difference />
      <HowItWorks />
      <CrossDevice />
      <Pricing />
      <FinalCta />
      <LandingFooter />
    </div>
  );
}

function SloeWordmark({ className = "" }: { className?: string }) {
  // The canonical splash logotype (public/sloe-wordmark.svg) rendered as a
  // recolorable CSS mask — matches the app + splash exactly (ENG-1247). Empty
  // element; the aria-label carries the proper-noun brand name.
  return (
    <span
      className={`lp-wordmark ${className}`.trim()}
      role="img"
      aria-label="Sloe"
    />
  );
}

function LandingHeader() {
  return (
    <header className="lp-nav">
      <div className="lp-nav-inner">
        <Link className="lp-brand" href="#lp-top">
          <SloeWordmark />
        </Link>
        <nav className="lp-nav-links" aria-label="Primary">
          {NAV_LINKS.map((l) =>
            l.href.startsWith("#") ? (
              <a key={l.href} href={l.href}>
                {l.label}
              </a>
            ) : (
              <Link key={l.href} href={l.href}>
                {l.label}
              </Link>
            ),
          )}
        </nav>
        <div className="lp-nav-right">
          <ThemeToggle />
          <Link className="lp-btn lp-btn-text lp-btn-sm" href={SIGNIN_HREF}>
            Log in
          </Link>
          <Link className="lp-btn lp-btn-primary lp-btn-sm" href={SIGNUP_HREF}>
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}

function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const active: "light" | "dark" | "system" = !mounted
    ? "system"
    : theme === "light" || theme === "dark" || theme === "system"
      ? theme
      : ((resolvedTheme as "light" | "dark") ?? "system");

  return (
    <div className="lp-theme-toggle" role="group" aria-label="Theme">
      <button
        type="button"
        aria-label="Light"
        aria-pressed={active === "light"}
        onClick={() => setTheme("light")}
      >
        <Sun width={14} height={14} aria-hidden />
      </button>
      <button
        type="button"
        aria-label="System"
        aria-pressed={active === "system"}
        onClick={() => setTheme("system")}
      >
        <Laptop width={14} height={14} aria-hidden />
      </button>
      <button
        type="button"
        aria-label="Dark"
        aria-pressed={active === "dark"}
        onClick={() => setTheme("dark")}
      >
        <Moon width={14} height={14} aria-hidden />
      </button>
    </div>
  );
}

function Hero() {
  // D-07 (ENG-1204): hybrid positioning leads with the tracker + "what to
  // eat next" coaching promise and demotes the import hook to the wedge
  // line. Gated behind `landing_hero_hybrid_v1` (default OFF — see
  // `src/lib/analytics/track.ts`); the current recipe-first hero stays
  // live in the flag-off path until the flag ramps to 100%.
  const hero = isFeatureEnabled("landing_hero_hybrid_v1") ? HERO_HYBRID : HERO_CURRENT;
  return (
    <section className="lp-hero">
      <div className="lp-wrap lp-hero-inner">
        <p className="lp-eyebrow-center">{hero.eyebrow}</p>
        <h1 className="lp-h-hero">
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
            Get the app
          </Link>
          <Link className="lp-btn lp-btn-outline lp-btn-lg" href={DISCOVER_HREF}>
            Browse recipes
            <ArrowRight width={16} height={16} aria-hidden />
          </Link>
        </div>
        <p className="lp-hero-login">
          Already cooking with Sloe?{" "}
          <Link href={SIGNIN_HREF} className="lp-link-underline">
            Log in
          </Link>
        </p>
      </div>
    </section>
  );
}

function Trending() {
  const railRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: -1 | 1) => {
    const el = railRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 310, behavior: "smooth" });
  };

  return (
    <section className="lp-section lp-trending">
      <div className="lp-wrap">
        <div className="lp-trending-head">
          <h2 className="lp-h-section">
            Trending <em>this week</em>
          </h2>
          <div className="lp-trending-nav">
            <button type="button" className="lp-icon-btn" aria-label="Scroll left" onClick={() => scroll(-1)}>
              <ChevronLeft width={18} height={18} aria-hidden />
            </button>
            <button type="button" className="lp-icon-btn" aria-label="Scroll right" onClick={() => scroll(1)}>
              <ChevronRight width={18} height={18} aria-hidden />
            </button>
          </div>
        </div>
        <div className="lp-trending-rail" ref={railRef} tabIndex={0} role="region" aria-label="Trending recipes">
          {TRENDING_RECIPES.map((recipe) => (
            <Link
              className="lp-recipe-card"
              key={recipe.title}
              href={recipe.href}
              aria-label={`${recipe.title} by ${recipe.author}`}
            >
              <div className="lp-recipe-card-top">
                <h3>{recipe.title}</h3>
                <Bookmark width={17} height={17} aria-hidden className="lp-recipe-bookmark" />
              </div>
              <div className="lp-recipe-img">
                <Image src={recipe.image} alt="" width={258} height={258} />
              </div>
              <p className="lp-recipe-author">
                By <span>{recipe.author}</span>
              </p>
            </Link>
          ))}
        </div>
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

function Pricing() {
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
            <Link className="lp-btn lp-btn-primary lp-btn-block" href={SIGNUP_HREF}>
              Start free trial
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

function FinalCta() {
  return (
    <section className="lp-section lp-final-cta">
      <div className="lp-wrap lp-final-cta-inner">
        <h2 className="lp-h-final">
          Cook what you love.
          <br />
          <em>Still</em> reach your goals.
        </h2>
        <p className="lp-lead-center">
          Join the people fitting the food they love into the life they want.
        </p>
        <Link className="lp-btn lp-btn-primary lp-btn-lg" href={SIGNUP_HREF}>
          Get the app — it&apos;s free
        </Link>
      </div>
    </section>
  );
}

function LandingFooter() {
  return (
    <footer className="lp-footer">
      <div className="lp-wrap">
        <div className="lp-footer-grid">
          <div className="lp-footer-brand">
            <SloeWordmark className="lp-wordmark-footer" />
            <p>The recipe + nutrition app for people who love food and have goals.</p>
          </div>
          <div className="lp-footer-cols">
            <div className="lp-footer-col">
              <h4>Product</h4>
              <ul>
                <li>
                  <Link href="/discover">Recipes</Link>
                </li>
                <li>
                  <a href="#how">How it works</a>
                </li>
                <li>
                  <a href="#pricing">Pricing</a>
                </li>
                <li>
                  <Link href={SIGNUP_HREF}>Download</Link>
                </li>
              </ul>
            </div>
            <div className="lp-footer-col">
              <h4>Company</h4>
              <ul>
                <li>
                  <Link href="/help">Help centre</Link>
                </li>
                <li>
                  <Link href="/whats-new">What&apos;s new</Link>
                </li>
                <li>
                  <Link href="/roadmap">Roadmap</Link>
                </li>
              </ul>
            </div>
            <div className="lp-footer-col">
              <h4>Legal</h4>
              <ul>
                <li>
                  <Link href="/privacy">Privacy</Link>
                </li>
                <li>
                  <Link href="/terms">Terms</Link>
                </li>
                <li>
                  <a href="mailto:support@getsloe.com">Contact</a>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="lp-f-attribution">
          <FatSecretBadge variant="badge" />
        </div>
        <div className="lp-footer-bottom">
          <div>© {new Date().getFullYear()} Sloe · Made for people who love food.</div>
          <div className="lp-footer-legal">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
