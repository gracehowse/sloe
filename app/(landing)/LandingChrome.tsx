"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Laptop, Moon, Sun } from "lucide-react";

import { isFeatureEnabled } from "../../src/lib/analytics/track.ts";
import { FatSecretBadge } from "../../src/app/components/ui/FatSecretBadge";
import {
  NAV_LINKS,
  SIGNIN_HREF,
  SIGNUP_CTA_LABEL,
  SIGNUP_HREF,
} from "./landingLinks.ts";

/**
 * Landing page chrome — wordmark, sticky nav, theme toggle, footer.
 *
 * Extracted from `LandingPage.tsx` in the design-consistency pass (2026-07-24):
 * the nav/footer changes below pushed that file past its line budget
 * (`npm run check:screen-budget`), and nav + footer are a coherent unit that
 * the page body never reaches into.
 */

export function SloeWordmark({ className = "" }: { className?: string }) {
  // ENG-1247: the splash logotype SVG (public/sloe-wordmark.svg) as a recolorable
  // CSS mask. Empty element; aria-label carries the proper-noun brand name.
  return <span className={`lp-wordmark ${className}`.trim()} role="img" aria-label="Sloe" />;
}

export function LandingHeader() {
  // Design-consistency pass (2026-07-24) — above the fold the landing offered
  // FOUR competing entries (nav "Get started" filled, hero "Get the app"
  // filled, hero "Browse recipes" outlined, "Log in" twice) plus a three-way
  // theme toggle carrying the same visual weight as Log in. Under the flag the
  // hero owns the ONE filled CTA, the nav CTA drops to ghost, and the
  // settings-tier theme toggle moves to the footer. Flag-off keeps the old nav
  // verbatim as the kill switch.
  const unifiedChrome = isFeatureEnabled("design_consistency_v1");
  return (
    <header className={unifiedChrome ? "lp-nav lp-nav--unified" : "lp-nav"}>
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
          {unifiedChrome ? null : <ThemeToggle />}
          <Link className="lp-btn lp-btn-text lp-btn-sm" href={SIGNIN_HREF}>
            Log in
          </Link>
          <Link
            className={
              unifiedChrome
                ? "lp-btn lp-btn-ghost lp-btn-sm"
                : "lp-btn lp-btn-primary lp-btn-sm"
            }
            href={SIGNUP_HREF}
          >
            {SIGNUP_CTA_LABEL}
          </Link>
        </div>
      </div>
    </header>
  );
}

export function ThemeToggle() {
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

export function LandingFooter() {
  // The theme toggle is a settings-tier preference, not a marketing control.
  // It sat in the primary nav at the same visual weight as "Log in"; under the
  // flag it lands here, beside the legal links, where site-wide preferences
  // belong. Flag-off keeps it in the nav (see `LandingHeader`).
  const unifiedChrome = isFeatureEnabled("design_consistency_v1");
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
            {unifiedChrome ? <ThemeToggle /> : null}
          </div>
        </div>
      </div>
    </footer>
  );
}
