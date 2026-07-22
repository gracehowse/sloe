"use client";

import * as React from "react";
import { Clock, Lock } from "lucide-react";
import { AnalyticsEvents } from "@/lib/analytics/events";
import { isFeatureEnabled, track } from "@/lib/analytics/track";
import { useOnboarding } from "../context";
import { ProgressiveText } from "../progressive-text";

/**
 * Web Welcome — v3 prototype `.ob--brand` / `.wob-brand` brand screen
 * (ENG-1247). A fixed deep-plum ground with a soft radial bloom behind the
 * lowercase Fraunces "sloe" wordmark, an italic serif tagline, a light
 * "Get started" CTA, and a "Private by default · About a minute" trust
 * footer. Fixed brand identity (same in light + dark) — does NOT theme-
 * resolve, so it reads from the fixed `--primary-deep` / `--primary-light`
 * / `--accent-frost` tokens (theme.css). Supersedes the pre-v3 oat ground +
 * success/macro-fat washes + floating product-preview tiles.
 *
 * Web twin of `apps/mobile/components/onboarding/steps/welcome.tsx` — same
 * deep-plum treatment, wordmark, tagline ("Still reach your goals", Grace's
 * call), CTA + trust footer; kept in parity (ENG-1247 M1 fix).
 */
export function WelcomeStep() {
  const { go, displayIndex, displayTotal } = useOnboarding();
  // ENG-720 — staggered reveal on the wordmark + tagline beat, behind the
  // default-OFF `onboarding_progressive_text` flag. `ProgressiveText` itself
  // also gates on prefers-reduced-motion; flag-OFF or reduce-motion → instant
  // text (zero visual change vs the pre-ENG-720 surface).
  const progressiveText = isFeatureEnabled("onboarding_progressive_text");
  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ backgroundColor: "var(--primary-deep)" }}
    >
      {/* Soft radial bloom behind the wordmark (prototype `.ob--brand::before`). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 56% at 50% 38%, color-mix(in oklab, var(--primary-light) 45%, transparent), transparent 62%)",
        }}
      />

      {/* Centered brand block — wordmark + italic tagline. */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
        <ProgressiveText
          as="h1"
          animate={progressiveText}
          aria-label="Sloe"
          className="m-0 font-[family-name:var(--font-brand)] text-[56px] font-light lowercase leading-none tracking-tight text-white md:text-[64px]"
        >
          sloe
        </ProgressiveText>
        <ProgressiveText
          as="p"
          animate={progressiveText}
          className="m-0 mt-5 max-w-[18ch] font-[family-name:var(--font-headline)] text-lg italic leading-snug md:text-2xl"
          style={{ color: "var(--accent-frost)" }}
        >
          Cook what you love. Still reach your goals.
        </ProgressiveText>
      </div>

      {/* Bottom CTA + trust footer. */}
      <div className="relative z-10 mx-auto w-full max-w-[440px] px-6 pb-8">
        <button
          type="button"
          onClick={() => {
            track(AnalyticsEvents.onboarding_step_completed, {
              step_id: "welcome",
              step_index: displayIndex,
              step_total: displayTotal,
            });
            go(1);
          }}
          className="flex h-14 w-full items-center justify-center rounded-full bg-white text-base font-bold transition-opacity hover:opacity-90 active:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          style={{ color: "var(--primary-deep)" }}
        >
          Get started
        </button>
        <button
          type="button"
          onClick={() => {
            // "I already have an account" — send returning visitors to the
            // canonical sign-in entry point (Grace 2026-04-20).
            if (typeof window !== "undefined") window.location.href = "/login";
          }}
          className="mt-4 block w-full py-2.5 text-center text-sm font-medium transition-opacity hover:opacity-70 focus:outline-none focus-visible:underline"
          style={{ color: "var(--accent-frost)" }}
        >
          I already have an account
        </button>
        <div
          className="mt-2 flex items-center justify-center gap-5"
          style={{ color: "var(--accent-frost)" }}
        >
          <TrustItem icon={<Lock size={13} strokeWidth={2} aria-hidden />} label="Private by default" />
          <TrustItem icon={<Clock size={13} strokeWidth={2} aria-hidden />} label="About a minute" />
        </div>
      </div>
    </div>
  );
}

function TrustItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-sm font-medium">
      {icon}
      {label}
    </span>
  );
}
