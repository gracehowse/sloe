"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Apple,
  ArrowRight,
  BatteryFull,
  BookOpen,
  CalendarDays,
  Check,
  ChefHat,
  ChevronDown,
  Cloud,
  Coffee,
  Compass,
  Database,
  Download,
  Flame,
  Globe,
  Home,
  Instagram,
  Laptop,
  Link as LinkIcon,
  Lock,
  Moon,
  ShoppingCart,
  Shield,
  Signal,
  Sun,
  Target,
  Timer,
  TrendingUp,
  User,
  Utensils,
  Wifi,
  Youtube,
} from "lucide-react";
import { MEAL_SLOT_HEADERS } from "../../src/lib/copy/today.ts";
import {
  FAQS,
  HOW_IT_WORKS,
  NUTRITION_SOURCES,
  PRICING_TIERS,
  ROADMAP,
  type RoadmapItem,
} from "../../src/lib/landing/content.ts";
import "./landing.css";
import { FatSecretBadge } from "../../src/app/components/ui/FatSecretBadge";

const NAV_LINKS = [
  { href: "#what", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#roadmap", label: "Roadmap" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

// Sign Up = the v2 onboarding flow (real Supabase signUp inline at
// step 02 — see app/signup/page.tsx which now 307s to /onboarding).
// Sign In = /login (unchanged).
const SIGNUP_HREF = "/onboarding";
const SIGNIN_HREF = "/login";

export function LandingPage() {
  return (
    <div className="lp-root" id="lp-top">
      <LandingHeader />
      <Hero />
      <HowItWorks />
      <Features />
      <Showcase />
      <Roadmap />
      <Pricing />
      <Faq />
      <CtaBlock />
      <LandingFooter />
    </div>
  );
}

/* ─────────────── Header ─────────────── */
function LandingHeader() {
  return (
    <header className="lp-nav">
      <div className="lp-nav-inner">
        <Link className="lp-brand" href="#lp-top" aria-label="Suppr">
          <span className="lp-mk">S</span>
          Suppr
        </Link>
        <nav className="lp-nav-links" aria-label="Primary">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>
        <div className="lp-nav-right">
          <ThemeToggle />
          <Link className="lp-btn lp-btn-ghost lp-btn-sm" href={SIGNIN_HREF}>
            Sign in
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

  // Until mounted, show the SSR placeholder (Auto pressed) so hydration matches.
  const active: "light" | "dark" | "system" = !mounted
    ? "system"
    : theme === "light" || theme === "dark" || theme === "system"
      ? theme
      : (resolvedTheme as "light" | "dark") ?? "system";

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

/* ─────────────── Hero ─────────────── */
function Hero() {
  return (
    <section className="lp-hero">
      <div className="lp-wrap lp-hero-grid">
        <div className="lp-hero-copy">
          <span className="lp-hero-chip">
            <span className="lp-tag">New</span>
            Paste a TikTok, get real macros
          </span>
          <h1 className="lp-h-display">
            Import any recipe.
            <br />
            Get real macros.
          </h1>
          <p className="lp-lead">
            Suppr is the recipe and nutrition platform for people who actually cook. Paste a link from
            Instagram, TikTok, or any recipe blog — Suppr parses every ingredient and matches it against
            USDA FoodData Central and other public food databases so you know what’s on the plate.
          </p>
          <div className="lp-hero-ctas">
            <Link className="lp-btn lp-btn-primary lp-btn-lg" href={SIGNUP_HREF}>
              Get started — it’s free
            </Link>
            <a className="lp-btn lp-btn-ghost lp-btn-lg" href="#what">
              See how it works
              <ArrowRight width={16} height={16} aria-hidden />
            </a>
          </div>
          <div className="lp-hero-sub">
            <div className="lp-item">
              <Check width={14} height={14} aria-hidden />
              Matched against USDA FoodData Central
            </div>
            <div className="lp-item">
              <Check width={14} height={14} aria-hidden />
              Web and iOS (TestFlight)
            </div>
            <div className="lp-item">
              <Check width={14} height={14} aria-hidden />
              No ads, no diet culture
            </div>
          </div>
        </div>

        <div className="lp-hero-visual" aria-hidden>
          <MiniBrowserMock />
          <PhoneTodayMock />
        </div>
      </div>

      <div className="lp-wrap">
        <div className="lp-trust-strip">
          <div className="lp-trust-inner">
            <div className="lp-lbl">Nutrition data matched against</div>
            <div className="lp-srcs">
              {NUTRITION_SOURCES.map((src) => (
                <span key={src}>
                  <Database aria-hidden />
                  {src}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function MiniBrowserMock() {
  return (
    <div className="lp-mini-browser">
      <div className="lp-mb-bar">
        <div className="lp-mb-dot" />
        <div className="lp-mb-dot" />
        <div className="lp-mb-dot" />
        <div className="lp-mb-url">
          <Lock width={10} height={10} aria-hidden />
          suppr-club.com /
        </div>
      </div>
      <div className="lp-mb-content">
        <div className="lp-mb-head">
          <div>
            <div className="lp-mb-h1">Today</div>
            <div className="lp-mb-sub">Wed, 14 May</div>
          </div>
          <span className="lp-mb-pill">On track</span>
        </div>
        <div className="lp-mb-hero">
          <div className="lp-mb-ring-sm">
            <svg width="90" height="90" viewBox="0 0 90 90" aria-hidden>
              <circle cx="45" cy="45" r="38" stroke="var(--lp-tile-border)" strokeWidth="7" fill="none" />
              <circle
                cx="45"
                cy="45"
                r="38"
                style={{ stroke: "var(--macro-calories)" }}
                strokeWidth="7"
                fill="none"
                strokeLinecap="round"
                strokeDasharray="238.8"
                strokeDashoffset="50"
              />
            </svg>
            <div className="lp-c">
              <div className="lp-ov">Remaining</div>
              <div className="lp-num">380</div>
              <div className="lp-rsub">of 1,800 kcal</div>
            </div>
          </div>
          <div className="lp-mb-metas">
            <Meta label="Logged" value="1,420" />
            <Meta label="Burned" value="2,180" />
            <Meta label="Target" value="1,800" />
            <Meta label="Net" value="−760" />
          </div>
        </div>
        <div className="lp-mb-macros">
          <MiniMacro label="P" value="92" pct={66} color="var(--macro-protein)" />
          <MiniMacro label="C" value="168" pct={93} color="var(--macro-carbs)" />
          <MiniMacro label="F" value="48" pct={80} color="var(--macro-fat)" />
          <MiniMacro label="Fib" value="22" pct={73} color="var(--macro-calories)" />
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="lp-mb-meta">
      <div className="lp-lbl">{label}</div>
      <div className="lp-v">{value}</div>
    </div>
  );
}

function MiniMacro({
  label,
  value,
  pct,
  color,
}: {
  label: string;
  value: string;
  pct: number;
  color: string;
}) {
  return (
    <div className="lp-mb-m">
      <div className="lp-lbl">{label}</div>
      <div className="lp-v">{value}</div>
      <div className="lp-bar">
        <i style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function PhoneTodayMock() {
  return (
    <div className="lp-phone">
      <div className="lp-phone-screen">
        <PhoneStatus />
        <div className="lp-ps-header">
          <div className="lp-ps-title-row">
            <div>
              <div className="lp-ps-title">Today</div>
              <div className="lp-ps-sub">Wed, 14 May</div>
            </div>
            <div className="lp-ps-avatar">GH</div>
          </div>
        </div>
        <div className="lp-ps-hero-card">
          <div className="lp-ps-ring">
            <svg width="140" height="140" viewBox="0 0 140 140" aria-hidden>
              <circle cx="70" cy="70" r="58" style={{ stroke: "var(--ring-bg)" }} strokeWidth="10" fill="none" />
              <circle
                cx="70"
                cy="70"
                r="58"
                style={{ stroke: "var(--macro-calories)" }}
                strokeWidth="10"
                fill="none"
                strokeLinecap="round"
                strokeDasharray="364.4"
                strokeDashoffset="77"
              />
            </svg>
            <div className="lp-c">
              <div className="lp-ov">Remaining</div>
              <div className="lp-num">380</div>
              <div className="lp-rsub">of 1,800 kcal</div>
            </div>
          </div>
        </div>
        <div className="lp-ps-macros">
          <PhoneMacro label="P" value="92" pct={66} color="var(--macro-protein)" />
          <PhoneMacro label="C" value="168" pct={93} color="var(--macro-carbs)" />
          <PhoneMacro label="F" value="48" pct={80} color="var(--macro-fat)" />
          <PhoneMacro label="Fib" value="22" pct={73} color="var(--macro-fiber)" />
        </div>
        <div className="lp-ps-meal-h">
          <div className="lp-t">{MEAL_SLOT_HEADERS.lunch}</div>
          <div className="lp-s">620 kcal</div>
        </div>
        <div className="lp-ps-meal">
          <div
            className="lp-ibx"
            style={{
              background: "color-mix(in oklab, var(--macro-protein) 18%, transparent)",
              color: "var(--macro-protein)",
            }}
          >
            <Utensils width={14} height={14} aria-hidden />
          </div>
          <div className="lp-info">
            <div className="lp-n">Sheet-pan chicken bowl</div>
            <div className="lp-d">Instagram</div>
          </div>
          <div className="lp-kc">620</div>
        </div>
        <PhoneTabBar />
        <div className="lp-ps-home" />
      </div>
    </div>
  );
}

function PhoneStatus() {
  return (
    <div className="lp-ps-status">
      <span>9:41</span>
      <div className="lp-icons">
        <Signal width={14} height={14} aria-hidden />
        <Wifi width={14} height={14} aria-hidden />
        <BatteryFull width={17} height={14} aria-hidden />
      </div>
    </div>
  );
}

function PhoneMacro({
  label,
  value,
  pct,
  color,
}: {
  label: string;
  value: string;
  pct: number;
  color: string;
}) {
  return (
    <div className="lp-ps-m">
      <div className="lp-lbl">{label}</div>
      <div className="lp-v">{value}</div>
      <div className="lp-bar">
        <i style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function PhoneTabBar() {
  // 2026-05-12 (premium-bar audit, web parity round 2): landing phone
  // mock IA must mirror the shipped 4-tab structure (Today / Recipes /
  // Plan / More) — not the old 5-tab v1 layout. Prospects compare the
  // landing mock to the real install; a 5-vs-4 mismatch is a trust
  // hit. Strategic direction lock: project_strategic_direction_2026-04-27.
  return (
    <div className="lp-ps-tabbar">
      <div className="lp-tab lp-active">
        <Home aria-hidden />
        Today
      </div>
      <div className="lp-tab">
        <BookOpen aria-hidden />
        Recipes
      </div>
      <div className="lp-tab">
        <CalendarDays aria-hidden />
        Plan
      </div>
      <div className="lp-tab">
        <User aria-hidden />
        More
      </div>
    </div>
  );
}

/* ─────────────── How it works ─────────────── */
function HowItWorks() {
  return (
    <section className="lp-section-pad" id="what">
      <div className="lp-wrap lp-what">
        <div>
          <span className="lp-eyebrow">
            <span className="lp-dot" />
            How it works
          </span>
          <h2 className="lp-h-section" style={{ marginTop: 12 }}>
            Recipes you actually save, tracked the way food actually works.
          </h2>
          <p className="lp-lead">
            Suppr matches ingredients against multiple verified databases and shows a confidence
            score when a match is ambiguous, so you can see what&apos;s certain and what isn&apos;t.
          </p>
          <div style={{ marginTop: 32, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link className="lp-btn lp-btn-primary" href={SIGNUP_HREF}>
              Start tracking free
              <ArrowRight width={16} height={16} aria-hidden />
            </Link>
            <a className="lp-btn lp-btn-link" href="#features">
              Explore features
            </a>
          </div>
        </div>
        <div className="lp-steps">
          {HOW_IT_WORKS.map((s) => (
            <div className="lp-step" key={s.n}>
              <div className="lp-n">{s.n}</div>
              <div>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────── Features ─────────────── */
function Features() {
  const cards = [
    {
      iconBg: "color-mix(in oklab, var(--primary) 12%, transparent)",
      iconColor: "var(--primary)",
      Icon: LinkIcon,
      title: "Recipe import",
      body:
        "Paste any URL. Suppr parses ingredients, steps, servings, and photos from any recipe site that publishes structured data, plus Instagram, TikTok, and YouTube posts.",
      meta: [
        { Icon: Globe, text: "Web" },
        { Icon: Instagram, text: "Instagram" },
        { Icon: Youtube, text: "TikTok & YT" },
      ],
    },
    {
      iconBg: "color-mix(in oklab, var(--macro-calories) 12%, transparent)",
      iconColor: "var(--macro-calories)",
      Icon: Flame,
      title: "Macro tracking",
      body:
        "Every ingredient matched against USDA FoodData Central (public domain) and other verified sources. Calories, protein, carbs, fat, fiber, sodium, sugar — all present.",
      meta: [
        { Icon: Database, text: "USDA FDC + OFF" },
        { Icon: Activity, text: "Confidence scores" },
      ],
    },
    {
      iconBg: "color-mix(in oklab, var(--macro-carbs) 12%, transparent)",
      iconColor: "var(--macro-carbs)",
      Icon: CalendarDays,
      title: "Meal planner",
      body:
        "Build a week from your saved recipes. Suppr picks combinations that land on your targets and generates a shopping list.",
      meta: [
        { Icon: Target, text: "Target-matched" },
        { Icon: ShoppingCart, text: "Shopping list" },
      ],
    },
    {
      iconBg: "color-mix(in oklab, var(--macro-fat) 12%, transparent)",
      iconColor: "var(--macro-fat)",
      Icon: ChefHat,
      title: "Cook mode",
      body:
        "Step-by-step cooking with inline timers parsed straight from the recipe. Screen stays on while you’re at the stove.",
      meta: [
        { Icon: Timer, text: "Inline timers" },
        { Icon: ChefHat, text: "Step highlighting" },
      ],
    },
  ];

  return (
    <section
      className="lp-section-pad"
      id="features"
      style={{
        background: "var(--lp-page-bg-soft)",
        borderTop: "var(--lp-hairline)",
        borderBottom: "var(--lp-hairline)",
      }}
    >
      <div className="lp-wrap">
        <div className="lp-features-head">
          <span className="lp-eyebrow">
            <span className="lp-dot" />
            Features
          </span>
          <h2 className="lp-h-section" style={{ marginTop: 12 }}>
            The core loop, done properly.
          </h2>
          <p className="lp-lead">
            Four things Suppr does better than a food diary, a recipe folder, or a macro calculator
            on their own.
          </p>
        </div>
        <div className="lp-f-grid">
          {cards.map((c) => (
            <div className="lp-f-card" key={c.title}>
              <div className="lp-f-icon" style={{ background: c.iconBg, color: c.iconColor }}>
                <c.Icon width={20} height={20} aria-hidden />
              </div>
              <h3>{c.title}</h3>
              <p>{c.body}</p>
              <div className="lp-meta">
                {c.meta.map((m) => (
                  <span key={m.text}>
                    <m.Icon width={12} height={12} aria-hidden />
                    {m.text}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────── Showcase ─────────────── */
function Showcase() {
  return (
    <section className="lp-section-pad lp-showcase">
      <div className="lp-wrap">
        <div className="lp-showcase-head">
          <span className="lp-eyebrow">
            <span className="lp-dot" />
            Designed for both
          </span>
          <h2 className="lp-h-section" style={{ marginTop: 12 }}>
            One system. Phone for logging, web for planning.
          </h2>
          <p className="lp-lead" style={{ margin: "14px auto 0" }}>
            Adaptive light and dark on every surface. Your data syncs the moment you save.
          </p>
        </div>
        <div className="lp-showcase-grid">
          <WebShot />
          <PhoneCookMock />
        </div>
      </div>
    </section>
  );
}

function WebShot() {
  return (
    <div className="lp-web-shot" aria-hidden>
      <div className="lp-ws-bar">
        <div className="lp-dot" />
        <div className="lp-dot" />
        <div className="lp-dot" />
        <div className="lp-url">
          <Lock width={10} height={10} aria-hidden />
          suppr-club.com /
        </div>
      </div>
      <div className="lp-ws-app">
        {/* 2026-05-12 (premium-bar audit, web parity round 2): mirror
            the shipped sidebar — 4 primary tabs (Today / Recipes /
            Plan / More), no flat "Track"/"Recipes" groupings. Library
            / Discover / Shopping / Progress live under their parent
            tabs in the real app; landing mock had them at the top
            level which mismatched the real install. */}
        <aside className="lp-ws-side">
          <div className="lp-ws-brand">
            <div className="lp-mk">S</div>
            <div className="lp-n">Suppr</div>
          </div>
          <a className="lp-active">
            <Home aria-hidden />
            Today
          </a>
          <a>
            <BookOpen aria-hidden />
            Recipes
          </a>
          <a>
            <CalendarDays aria-hidden />
            Plan
          </a>
          <a>
            <User aria-hidden />
            More
          </a>
        </aside>
        <div className="lp-ws-main">
          <div className="lp-ws-topline">
            <div>
              <h3 className="lp-ws-h">Today</h3>
            </div>
            <span className="lp-mb-pill">On track</span>
          </div>
          <div className="lp-ws-card">
            <div className="lp-ws-hero-row">
              <div className="lp-ws-ring">
                <svg width="112" height="112" viewBox="0 0 112 112" aria-hidden>
                  <circle cx="56" cy="56" r="46" stroke="var(--lp-tile-border)" strokeWidth="8" fill="none" />
                  <circle
                    cx="56"
                    cy="56"
                    r="46"
                    stroke="var(--success)"
                    strokeWidth="8"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray="289"
                    strokeDashoffset="61"
                  />
                </svg>
                <div className="lp-c">
                  <div className="lp-ov">Remaining</div>
                  <div className="lp-num">380</div>
                  <div className="lp-rsub">of 1,800 kcal</div>
                </div>
              </div>
              <div className="lp-ws-metas">
                <WsMeta label="Logged" value="1,420" detail="3 meals" />
                <WsMeta label="Target" value="1,800" detail="Mifflin-St Jeor" />
                <WsMeta label="Burned" value="2,180" detail="Activity" />
                <WsMeta label="Net" value="−760" detail="deficit" />
              </div>
            </div>
            <div className="lp-ws-macros">
              <WsMacro label="Protein" value="92" unit=" / 140g" pct={66} color="var(--macro-protein)" />
              <WsMacro label="Carbs" value="168" unit=" / 180g" pct={93} color="var(--macro-carbs)" />
              <WsMacro label="Fat" value="48" unit=" / 60g" pct={80} color="var(--macro-fat)" />
              <WsMacro label="Fiber" value="22" unit=" / 30g" pct={73} color="var(--macro-calories)" />
            </div>
            <div className="lp-ws-section-h">
              <div className="lp-t">{MEAL_SLOT_HEADERS.breakfast}</div>
              <div className="lp-a">280 kcal</div>
            </div>
            <div className="lp-ws-meals">
              <WsMeal
                Icon={Coffee}
                iconBg="color-mix(in oklab, var(--success) 15%, transparent)"
                iconColor="var(--success)"
                name="Greek yogurt & berries"
                sub="08:40"
                kc="280"
              />
            </div>
            <div className="lp-ws-section-h">
              <div className="lp-t">{MEAL_SLOT_HEADERS.lunch}</div>
              <div className="lp-a">620 kcal</div>
            </div>
            <div className="lp-ws-meals">
              <WsMeal
                Icon={Utensils}
                iconBg="color-mix(in oklab, var(--primary) 15%, transparent)"
                iconColor="var(--primary)"
                name="Sheet-pan chicken bowl"
                sub="Instagram"
                kc="620"
              />
            </div>
            <div className="lp-ws-section-h">
              <div className="lp-t">{MEAL_SLOT_HEADERS.snack}</div>
              <div className="lp-a">220 kcal</div>
            </div>
            <div className="lp-ws-meals">
              <WsMeal
                Icon={Apple}
                iconBg="color-mix(in oklab, var(--warning) 15%, transparent)"
                iconColor="var(--warning)"
                name="Apple & peanut butter"
                sub="2 servings"
                kc="220"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WsMeta({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="lp-ws-meta">
      <div className="lp-lbl">{label}</div>
      <div className="lp-v">{value}</div>
      <div className="lp-d">{detail}</div>
    </div>
  );
}

function WsMacro({
  label,
  value,
  unit,
  pct,
  color,
}: {
  label: string;
  value: string;
  unit: string;
  pct: number;
  color: string;
}) {
  return (
    <div className="lp-ws-m">
      <div className="lp-lbl">{label}</div>
      <div className="lp-v">
        {value}
        <span className="lp-unit">{unit}</span>
      </div>
      <div className="lp-bar">
        <i style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function WsMeal({
  Icon,
  iconBg,
  iconColor,
  name,
  sub,
  kc,
}: {
  Icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  name: string;
  sub: string;
  kc: string;
}) {
  return (
    <div className="lp-ws-meal">
      <div className="lp-ws-meal-icon" style={{ background: iconBg, color: iconColor }}>
        <Icon width={13} height={13} aria-hidden />
      </div>
      <div className="lp-ws-meal-info">
        <div className="lp-ws-meal-name">{name}</div>
        <div className="lp-ws-meal-sub">{sub}</div>
      </div>
      <div className="lp-ws-meal-kc">{kc}</div>
    </div>
  );
}

function PhoneCookMock() {
  return (
    <div className="lp-phone" style={{ margin: "0 auto" }} aria-hidden>
      <div className="lp-phone-screen">
        <PhoneStatus />
        <div className="lp-cook-head">
          <div className="lp-cook-overline">Cook mode</div>
          <div className="lp-cook-title">Sheet-pan chicken</div>
          <div className="lp-cook-sub">Step 3 of 7 · 42 min total</div>
        </div>
        <div className="lp-cook-art">
          <div className="lp-cook-art-row">
            <div className="lp-cook-overline">Timer running</div>
            <div className="lp-cook-timer">12:40</div>
          </div>
        </div>
        <div className="lp-cook-step">
          <div className="lp-cook-step-label">Step 3</div>
          <div className="lp-cook-step-body">
            Roast chicken and vegetables 25 minutes, tossing halfway, until chicken is cooked through.
          </div>
          <div className="lp-cook-step-actions">
            <div>
              <Timer width={12} height={12} aria-hidden />
              Start timer
            </div>
          </div>
        </div>
        <div className="lp-cook-nav">
          <div className="lp-cook-nav-prev">← Step 2</div>
          <div className="lp-cook-nav-next">Step 4 →</div>
        </div>
        <div className="lp-ps-home" />
      </div>
    </div>
  );
}

/* ─────────────── Roadmap ─────────────── */
function Roadmap() {
  return (
    <section className="lp-section-pad" id="roadmap">
      <div className="lp-wrap">
        <div className="lp-roadmap-head">
          <span className="lp-eyebrow lp-ok">
            <span className="lp-dot" />
            Roadmap
          </span>
          <h2 className="lp-h-section" style={{ marginTop: 12 }}>
            What’s shipping, what’s next.
          </h2>
          <p className="lp-lead" style={{ margin: "14px auto 0" }}>
            Transparent progress. No countdown timers, no “coming soon” vapourware. Published monthly.
          </p>
        </div>

        <div className="lp-roadmap">
          {ROADMAP.map((bucket) => {
            const cls =
              bucket.title === "Now"
                ? "lp-rm-item lp-now"
                : bucket.title === "Next"
                  ? "lp-rm-item lp-next"
                  : "lp-rm-item lp-later";
            const badgeCls =
              bucket.title === "Now"
                ? "lp-rm-badge lp-now"
                : bucket.title === "Next"
                  ? "lp-rm-badge lp-next"
                  : "lp-rm-badge lp-later";
            return (
              <div className={cls} key={bucket.title}>
                <div className="lp-rm-dot">
                  {bucket.title === "Now" ? (
                    <Check width={12} height={12} aria-hidden style={{ color: "#fff" }} />
                  ) : null}
                </div>
                <div className="lp-rm-body">
                  <div className="lp-rm-head">
                    <h3>{bucket.title}</h3>
                    <span className={badgeCls}>{bucket.badge}</span>
                    <span className="lp-rm-when">{bucket.when}</span>
                  </div>
                  <p>{bucket.summary}</p>
                  <div className="lp-rm-ships">
                    {bucket.items.map((it) => (
                      <Ship key={it.text} item={it} />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Ship({ item }: { item: RoadmapItem }) {
  const cls = [
    "lp-rm-ship",
    item.status === "shipped" ? "lp-done" : "",
    item.status === "building" ? "lp-progress" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls}>
      <div className="lp-c">
        {item.status === "shipped" ? <Check width={10} height={10} aria-hidden /> : null}
      </div>
      <div className="lp-txt">{item.text}</div>
    </div>
  );
}

/* ─────────────── Pricing ─────────────── */
function Pricing() {
  return (
    <section
      className="lp-section-pad"
      id="pricing"
      style={{
        background: "var(--lp-page-bg-soft)",
        borderTop: "var(--lp-hairline)",
        borderBottom: "var(--lp-hairline)",
      }}
    >
      <div className="lp-wrap">
        <div className="lp-pricing-head">
          <span className="lp-eyebrow">
            <span className="lp-dot" />
            Pricing
          </span>
          <h2 className="lp-h-section" style={{ marginTop: 12 }}>
            Everything you need to eat well.
          </h2>
          <p className="lp-lead" style={{ margin: "14px auto 0" }}>
            Pick the plan that fits your goals. Cancel anytime — your data stays.
          </p>
        </div>
        <div className="lp-tier-grid">
          {PRICING_TIERS.map((t) => {
            const ctaLabel =
              t.checkoutTier === null ? "Continue for free" : `Upgrade to ${t.name}`;
            return (
              <div className={`lp-tier${t.highlighted ? " lp-tier-hero" : ""}`} key={t.name}>
                <h3>{t.name}</h3>
                <p className="lp-tag">{t.tag}</p>
                <div className="lp-price-row">
                  <span className="lp-price">{t.price}</span>
                  <span className="lp-per">{t.period}</span>
                </div>
                <div className="lp-tier-btn">
                  <Link
                    className={`lp-btn ${t.highlighted ? "lp-btn-primary" : "lp-btn-ghost"}`}
                    href={SIGNUP_HREF}
                  >
                    {ctaLabel}
                  </Link>
                </div>
                {t.featHead ? <div className="lp-feat-head">{t.featHead}</div> : null}
                <ul className="lp-feat-list">
                  {t.features.map((f) => (
                    <li key={f}>
                      <Check width={16} height={16} aria-hidden />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
        <div className="lp-pricing-trust">
          <span>
            <Shield width={14} height={14} aria-hidden style={{ color: "var(--macro-calories)" }} />
            Cancel anytime
          </span>
          <span>
            <Cloud width={14} height={14} aria-hidden style={{ color: "var(--primary)" }} />
            Cloud sync across devices
          </span>
          <span>
            <Download width={14} height={14} aria-hidden style={{ color: "var(--macro-fat)" }} />
            Export your data anytime
          </span>
          <span>
            {/* Monetisation-architect round-2 (2026-04-19): surface the
                refund policy on the landing's pricing trust strip so
                the commitment shows up *before* the CTA, not only in
                the FAQ or the per-tier disclosure. Links into the
                Terms page anchor added in B2. */}
            <Shield width={14} height={14} aria-hidden style={{ color: "var(--primary)" }} />
            <a
              href="/terms#refunds"
              style={{ color: "var(--lp-fg-secondary)", textDecoration: "underline", textUnderlineOffset: "2px" }}
            >
              7-day refund policy
            </a>
          </span>
        </div>
      </div>
    </section>
  );
}

/* ─────────────── FAQ ─────────────── */
function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  return (
    <section className="lp-section-pad" id="faq">
      <div className="lp-wrap">
        <div className="lp-faq-head">
          <span className="lp-eyebrow">
            <span className="lp-dot" />
            FAQ
          </span>
          <h2 className="lp-h-section" style={{ marginTop: 12 }}>
            Questions, answered honestly.
          </h2>
        </div>
        <div className="lp-faq-list">
          {FAQS.map((f, i) => {
            const open = openIndex === i;
            return (
              <div className={`lp-faq-item${open ? " lp-open" : ""}`} key={f.q}>
                <button
                  type="button"
                  className="lp-faq-q"
                  aria-expanded={open}
                  onClick={() => setOpenIndex(open ? null : i)}
                >
                  <span>{f.q}</span>
                  <ChevronDown width={18} height={18} aria-hidden />
                </button>
                <div className="lp-faq-a" role="region">
                  {f.a}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─────────────── CTA block ─────────────── */
function CtaBlock() {
  return (
    <section style={{ padding: "0 0 24px" }}>
      <div className="lp-wrap">
        <div className="lp-cta-block">
          <h2>Start cooking what the numbers say.</h2>
          <p>Free forever, no credit card. Import your first recipe in under a minute.</p>
          <div className="lp-ctas">
            <Link className="lp-btn lp-btn-primary lp-btn-lg" href={SIGNUP_HREF}>
              Get started — it’s free
            </Link>
            <a className="lp-btn lp-btn-ghost lp-btn-lg" href="#pricing">
              See pricing
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────── Footer ─────────────── */
function LandingFooter() {
  return (
    <footer className="lp-footer">
      <div className="lp-wrap">
        <div className="lp-f-grid-foot">
          <div className="lp-f-brand">
            <div className="lp-brand">
              <span className="lp-mk">S</span>
              Suppr
            </div>
            <p>The recipe and nutrition platform for people who actually cook. Built in London.</p>
          </div>
          <div className="lp-f-col">
            <h4>Product</h4>
            <ul>
              <li>
                <a href="#features">Features</a>
              </li>
              <li>
                <Link href="/pricing">Pricing</Link>
              </li>
              <li>
                <Link href="/roadmap">Roadmap</Link>
              </li>
              <li>
                <Link href="/help">Help</Link>
              </li>
              <li>
                <Link href={SIGNUP_HREF}>Get started</Link>
              </li>
              <li>
                <Link href={SIGNIN_HREF}>Sign in</Link>
              </li>
            </ul>
          </div>
          <div className="lp-f-col">
            <h4>Legal</h4>
            <ul>
              <li>
                <Link href="/privacy">Privacy</Link>
              </li>
              <li>
                <Link href="/terms">Terms</Link>
              </li>
              <li>
                <Link href="/dmca">DMCA</Link>
              </li>
              <li>
                <Link href="/licences">Licences</Link>
              </li>
            </ul>
          </div>
        </div>
        {/* FatSecret attribution — required by FatSecret Platform API ToS.
            Public, login-free placement per policy requirement. */}
        <div className="lp-f-attribution">
          <FatSecretBadge variant="badge" />
        </div>
        <div className="lp-f-bottom">
          <div>© {new Date().getFullYear()} Suppr. All rights reserved.</div>
          <div className="lp-legal">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/dmca">DMCA</Link>
            <Link href="/licences">Licences</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
