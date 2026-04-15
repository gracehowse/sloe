"use client";

import Link from "next/link";
import { useState } from "react";
import { SupprLogoMark } from "./components/SupprLogoMark.tsx";

/* ─── Features (2×2 grid) ─── */
const FEATURES = [
  {
    title: "Save from anywhere",
    description:
      "Paste a link from Instagram, TikTok, YouTube, or any recipe blog. Suppr extracts the full recipe — ingredients, steps, and macros — so you never lose something you want to cook.",
    color: "#4c6ce0",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.93a2 2 0 00-1.66.5l-2.54 2.54a2 2 0 01-1.66.5H4" />
      </svg>
    ),
  },
  {
    title: "Trust the macros",
    description:
      "Every saved recipe gets ingredient-level macro calculations with a confidence score. You see exactly how accurate the numbers are — no guessing, no blindly trusting a crowd-sourced database.",
    color: "#22a860",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: "Plan your week",
    description:
      "Drag dishes from your saved recipes into a weekly plan. Suppr totals the macros for each day and generates a shopping list from exactly the ingredients you need.",
    color: "#e8a020",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    title: "Track in seconds",
    description:
      "Tap a planned meal to log it instantly. Or use search, barcode scanning, voice, or a photo — whatever's fastest. Apple Health syncs steps, burn, and weight automatically.",
    color: "#e04888",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
];

/* ─── How-it-works walkthrough ─── */
const STEPS = [
  {
    id: "save",
    label: "Save",
    heading: "Save recipes from the places you actually find them.",
    body: "Paste a link from Instagram, TikTok, YouTube, or any recipe blog. Suppr extracts the full recipe — ingredients, steps, and macros — so you never lose something you want to cook.",
    footnote: "Supports 50+ sites and social platforms.",
  },
  {
    id: "trust",
    label: "Trust",
    heading: "Macros you can actually rely on.",
    body: "Every saved recipe gets ingredient-level macro calculations with a confidence score. You see exactly how accurate the numbers are — no guessing, no blindly trusting a crowd-sourced database.",
    footnote: "Portion scaling and plausibility checks built in.",
  },
  {
    id: "plan",
    label: "Plan",
    heading: "Turn your library into a week you'll cook.",
    body: "Drag dishes from your saved recipes into a weekly plan. Suppr totals the macros for each day and generates a shopping list from exactly the ingredients you need.",
    footnote: "Adjusts for servings. One tap to build your list.",
  },
  {
    id: "track",
    label: "Track",
    heading: "Log meals in seconds, not minutes.",
    body: "Tap a planned meal to log it instantly. Or use search, barcode scanning, voice, or a photo — whatever's fastest right now. Apple Health syncs steps, burn, and weight automatically.",
    footnote: "Works on iOS and web.",
  },
];

function Walkthrough() {
  const [active, setActive] = useState(0);
  const s = STEPS[active];

  return (
    <div className="w-full">
      {/* Tab bar — scroll on narrow screens so pills never crush */}
      <div className="mb-10 sm:mb-14 -mx-1 px-1 sm:mx-0 sm:px-0">
        <div className="flex justify-center overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div
            className="inline-flex shrink-0 gap-0.5 rounded-full border border-[var(--border)] bg-[var(--card)] p-1 shadow-sm"
            role="tablist"
            aria-label="How it works steps"
          >
            {STEPS.map((step, i) => (
              <button
                key={step.id}
                type="button"
                role="tab"
                aria-selected={i === active}
                onClick={() => setActive(i)}
                className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition-all duration-200 sm:px-5 sm:text-sm ${
                  i === active
                    ? "bg-[var(--primary)] text-white shadow-sm"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]/40 hover:text-[var(--foreground)]"
                }`}
              >
                {step.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Active step content */}
      <div className="mx-auto max-w-2xl px-1 text-center sm:px-0">
        <h3 className="text-balance text-[clamp(1.2rem,2.8vw,1.65rem)] font-semibold leading-snug tracking-tight text-[var(--foreground)]">
          {s.heading}
        </h3>
        <p className="mt-5 text-pretty text-[15px] leading-relaxed text-[var(--muted-foreground)] sm:mt-6 sm:text-[17px] sm:leading-relaxed">
          {s.body}
        </p>
        <p className="mt-4 text-sm leading-normal text-[var(--muted-foreground)]/80 sm:mt-5">{s.footnote}</p>
      </div>
    </div>
  );
}

/* ─── Main landing page ─── */
const sectionShell = "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8";
const narrowShell = "mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8";

export function MarketingLanding() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] antialiased">
      {/* ── Nav ── */}
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-[var(--glass-border)] bg-[var(--glass)] pt-[env(safe-area-inset-top,0px)] backdrop-blur-xl">
        <div className={`${sectionShell} flex h-14 items-center justify-between gap-3 sm:h-[3.75rem]`}>
          <Link
            href="/"
            className="flex min-w-0 shrink items-center gap-2 text-[var(--foreground)] transition-opacity hover:opacity-85"
          >
            <SupprLogoMark className="h-8 w-8 shrink-0 sm:h-9 sm:w-9" />
            <span className="truncate text-[15px] font-bold tracking-tight sm:text-base">Suppr</span>
          </Link>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-1 sm:gap-2">
            <Link
              href="/roadmap"
              className="rounded-lg px-2 py-2 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)]/30 hover:text-[var(--foreground)] sm:px-3 sm:text-sm"
            >
              Roadmap
            </Link>
            <Link
              href="/pricing"
              className="rounded-lg px-2 py-2 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)]/30 hover:text-[var(--foreground)] sm:px-3 sm:text-sm"
            >
              Pricing
            </Link>
            <Link
              href="/login?mode=signin"
              className="rounded-lg px-2 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:text-[var(--primary)] sm:px-3"
            >
              Sign in
            </Link>
            <Link href="/signup" className="btn-primary shrink-0 px-4 py-2 text-sm sm:px-5">
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <header className="relative overflow-hidden pb-20 pt-[calc(7rem+env(safe-area-inset-top,0px))] sm:pb-28 sm:pt-[calc(10rem+env(safe-area-inset-top,0px))]">
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-90"
          style={{
            background: "radial-gradient(ellipse 85% 55% at 50% 0%, var(--accent-muted) 0%, transparent 72%)",
          }}
        />
        <div className={`${narrowShell} text-center`}>
          <div className="mb-7 inline-flex items-center justify-center sm:mb-9">
            <SupprLogoMark className="h-14 w-14 sm:h-[4.25rem] sm:w-[4.25rem]" />
          </div>
          <h1 className="mb-6 text-balance text-[clamp(2rem,5.5vw,3.25rem)] font-bold leading-[1.08] tracking-tight text-[var(--foreground)]">
            Save recipes. Trust the macros.
            <br />
            <span className="text-[var(--primary)]">Plan your week.</span>
          </h1>
          <p className="mx-auto mb-10 max-w-[36rem] text-pretty text-[clamp(1rem,2.2vw,1.2rem)] leading-relaxed text-[var(--muted-foreground)] sm:mb-12 sm:leading-relaxed">
            The only app where the recipes you find online become the meals you plan, cook, and track — with nutrition
            you can actually believe.
          </p>
          <div className="flex w-full max-w-md flex-col items-stretch justify-center gap-3 sm:mx-auto sm:max-w-none sm:flex-row sm:items-center sm:gap-4">
            <Link
              href="/signup"
              className="btn-primary inline-flex min-h-[48px] items-center justify-center px-6 py-3 text-base shadow-[0_4px_20px_var(--accent-muted)] sm:min-h-[52px] sm:px-8 sm:text-[17px]"
            >
              Get started — it&apos;s free
            </Link>
            <Link
              href="/login?mode=signin"
              className="btn-secondary inline-flex min-h-[48px] items-center justify-center px-6 py-3 text-base sm:min-h-[52px] sm:px-8 sm:text-[17px]"
            >
              Sign in
            </Link>
          </div>
          <p className="mt-5 text-center text-[13px] text-[var(--muted-foreground)]/85 sm:mt-6">Free to use. No credit card.</p>
        </div>
      </header>

      {/* ── Value strip ── */}
      <section className="border-y border-[var(--border)] bg-[var(--card)]/30 py-10 sm:py-12">
        <div className={sectionShell}>
          <p className="mx-auto max-w-2xl text-center text-pretty text-[clamp(0.95rem,1.9vw,1.125rem)] font-medium leading-relaxed tracking-wide text-[var(--muted-foreground)]">
            One workspace for recipes, macros, meal plans, and tracking. No more juggling three apps.
          </p>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-16 sm:py-24 lg:py-28">
        <div className={sectionShell}>
          <h2 className="section-label mb-10 text-center sm:mb-14">Everything you need</h2>
          <ul className="m-0 grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 sm:gap-6 lg:gap-8">
            {FEATURES.map((f) => (
              <li key={f.title} className="h-full">
                <div className="group card-landing flex h-full flex-col gap-4 p-6 sm:gap-5 sm:p-8">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white transition-transform duration-200 group-hover:scale-[1.06]"
                    style={{ backgroundColor: f.color }}
                  >
                    {f.icon}
                  </div>
                  <h3 className="text-balance text-lg font-semibold tracking-tight text-[var(--foreground)] sm:text-xl">
                    {f.title}
                  </h3>
                  <p className="text-pretty text-[15px] leading-relaxed text-[var(--muted-foreground)] sm:text-[16px]">
                    {f.description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="border-y border-[var(--border)] bg-[var(--card)]/50 py-16 sm:py-24 lg:py-28">
        <div className={sectionShell}>
          <h2 className="section-label mb-8 text-center sm:mb-10">How it works</h2>
          <Walkthrough />
        </div>
      </section>

      {/* ── Trust strip ── */}
      <section className="py-14 sm:py-20 lg:py-24">
        <div className={`${narrowShell} text-center`}>
          <p className="text-balance text-[clamp(1.2rem,2.8vw,1.65rem)] font-semibold leading-snug tracking-tight text-[var(--foreground)]">
            Your data stays yours.
          </p>
          <p className="mx-auto mt-4 max-w-lg text-pretty text-[15px] leading-relaxed text-[var(--muted-foreground)] sm:mt-5 sm:text-[17px]">
            No ads. No selling your recipe library. Export your data whenever you want — you&apos;re never locked in.
            Open roadmap so you shape what gets built.
          </p>
        </div>
      </section>

      {/* ── Roadmap teaser ── */}
      <section className="py-16 sm:py-24 lg:py-28">
        <div className="mx-auto w-full max-w-2xl px-4 text-center sm:px-6">
          <h2 className="section-label mb-3 sm:mb-4">What&apos;s coming</h2>
          <p className="text-balance text-[clamp(1.2rem,2.8vw,1.65rem)] font-semibold leading-snug tracking-tight text-[var(--foreground)]">
            Shipped fast, improving weekly.
          </p>
          <p className="mx-auto mt-4 max-w-md text-pretty text-[15px] leading-relaxed text-[var(--muted-foreground)] sm:mt-5 sm:text-[17px]">
            We publish our full roadmap and ship updates every week. If something matters to you, you can upvote it.
          </p>
          <div className="mt-8 sm:mt-10">
            <Link href="/roadmap" className="btn-secondary inline-flex min-h-[44px] items-center justify-center px-6 py-2.5 text-[15px]">
              View the full roadmap
            </Link>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-20 sm:py-28 lg:py-32">
        <div className="mx-auto w-full max-w-2xl px-4 text-center sm:px-6">
          <h2 className="text-balance text-[clamp(1.45rem,3.8vw,2.35rem)] font-bold leading-tight tracking-tight text-[var(--foreground)]">
            Start eating on target.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-pretty text-[17px] leading-relaxed text-[var(--muted-foreground)] sm:mt-5">
            Set your macros, save your first recipe, and plan your week — in a few minutes.
          </p>
          <div className="mt-9 flex w-full max-w-md flex-col items-stretch justify-center gap-3 sm:mx-auto sm:mt-10 sm:max-w-none sm:flex-row sm:gap-4">
            <Link
              href="/signup"
              className="btn-primary inline-flex min-h-[48px] items-center justify-center px-6 py-3 text-base shadow-[0_4px_20px_var(--accent-muted)] sm:min-h-[52px] sm:px-8 sm:text-[17px]"
            >
              Create a free account
            </Link>
            <Link
              href="/login?mode=signin"
              className="btn-secondary inline-flex min-h-[48px] items-center justify-center px-6 py-3 text-base sm:min-h-[52px] sm:px-8 sm:text-[17px]"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-[var(--border)] bg-[var(--card)]/20 py-12 sm:py-14">
        <div className={`${sectionShell} flex flex-col items-center gap-8 md:flex-row md:items-center md:justify-between md:gap-6`}>
          <Link
            href="/"
            className="flex items-center gap-2 text-[var(--muted-foreground)] transition-opacity hover:opacity-80 md:shrink-0"
          >
            <SupprLogoMark className="h-6 w-6" />
            <span className="text-sm font-semibold">Suppr</span>
          </Link>
          <nav
            className="flex max-w-full flex-wrap items-center justify-center gap-x-6 gap-y-2.5 text-[13px] text-[var(--muted-foreground)] sm:gap-x-8"
            aria-label="Footer"
          >
            <Link href="/roadmap" className="rounded-md px-1 py-0.5 transition-colors hover:text-[var(--foreground)]">
              Roadmap
            </Link>
            <Link href="/pricing" className="rounded-md px-1 py-0.5 transition-colors hover:text-[var(--foreground)]">
              Pricing
            </Link>
            <Link href="/login?mode=signin" className="rounded-md px-1 py-0.5 transition-colors hover:text-[var(--foreground)]">
              Sign in
            </Link>
            <Link href="/signup" className="rounded-md px-1 py-0.5 transition-colors hover:text-[var(--foreground)]">
              Create account
            </Link>
          </nav>
          <p className="text-center text-xs text-[var(--muted-foreground)]/70 md:text-right">&copy; {new Date().getFullYear()} Suppr</p>
        </div>
      </footer>
    </div>
  );
}
