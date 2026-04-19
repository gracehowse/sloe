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
  HeartPulse,
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
import "./landing.css";

const NAV_LINKS = [
  { href: "#what", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#roadmap", label: "Roadmap" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

const FAQS = [
  {
    q: "How accurate are the macros, really?",
    a: "Every ingredient is matched against USDA FoodData Central first, then Open Food Facts, then FatSecret for branded items. Ambiguous ingredients show a confidence score so you can verify before saving. Values are estimates — actual nutrition varies by preparation method, brand, and portion size.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel from account settings and you’ll keep access until the end of your billing period. Your data stays — you can export it any time from Settings → Export.",
  },
  {
    q: "Does it work on iOS and web?",
    a: "Yes — the web app is in production and the iOS app is in TestFlight beta. Both share the same Supabase backend, so anything you save or log syncs instantly. Android isn’t on the roadmap right now.",
  },
  {
    q: "What happens to my data if I downgrade?",
    a: "Nothing disappears. Recipes above the Free tier’s 10-recipe limit become read-only until you upgrade again, but they’re never deleted. History, logs, and targets stay fully accessible.",
  },
  {
    q: "Is this a diet app?",
    a: "No. Suppr is a personal tracking tool, not a medical device. We don’t do leaderboards or shaming — over-budget shows amber, not red, and targets are based on Mifflin-St Jeor so you can override them. You can opt into a gentle logging streak if you want one; it’s off by default.",
  },
  {
    q: "Is there an annual plan?",
    a: "Not yet, but it's coming. Subscribe monthly now and we'll offer a discounted annual option when it launches.",
  },
  {
    q: "Do you offer refunds?",
    a: "Yes — if you're unhappy within the first 7 days, contact support and we'll issue a full refund, no questions asked.",
  },
];

const SIGNUP_HREF = "/login?mode=signup";
const SIGNIN_HREF = "/login?mode=signin";

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
            Instagram, TikTok, or any recipe blog — Suppr parses every ingredient against USDA data so
            you know exactly what’s on the plate.
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
              USDA-verified nutrition
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
              <span>
                <Database aria-hidden />
                USDA FoodData Central
              </span>
              <span>
                <Database aria-hidden />
                Open Food Facts
              </span>
              <span>
                <Database aria-hidden />
                FatSecret
              </span>
              <span>
                <HeartPulse aria-hidden />
                Apple Health
              </span>
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
                stroke="#22a860"
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
              <circle cx="70" cy="70" r="58" stroke="#1e1e2a" strokeWidth="10" fill="none" />
              <circle
                cx="70"
                cy="70"
                r="58"
                stroke="#4cd080"
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
          <PhoneMacro label="P" value="92" pct={66} color="#6c8cff" />
          <PhoneMacro label="C" value="168" pct={93} color="#ffc04c" />
          <PhoneMacro label="F" value="48" pct={80} color="#ff7eb3" />
          <PhoneMacro label="Fib" value="22" pct={73} color="#4cd080" />
        </div>
        <div className="lp-ps-meal-h">
          <div className="lp-t">{MEAL_SLOT_HEADERS.lunch}</div>
          <div className="lp-s">620 kcal</div>
        </div>
        <div className="lp-ps-meal">
          <div className="lp-ibx" style={{ background: "rgba(108,140,255,0.18)", color: "#6c8cff" }}>
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
  return (
    <div className="lp-ps-tabbar">
      <div className="lp-tab lp-active">
        <Home aria-hidden />
        Today
      </div>
      <div className="lp-tab">
        <Compass aria-hidden />
        Discover
      </div>
      <div className="lp-tab">
        <CalendarDays aria-hidden />
        Plan
      </div>
      <div className="lp-tab">
        <TrendingUp aria-hidden />
        Progress
      </div>
      <div className="lp-tab">
        <User aria-hidden />
        Profile
      </div>
    </div>
  );
}

/* ─────────────── How it works ─────────────── */
function HowItWorks() {
  const steps = [
    {
      n: 1,
      title: "Paste a link — we handle the rest",
      body:
        "Drop a URL from Instagram, TikTok, YouTube, or any recipe blog. Suppr imports ingredients, steps, and photos in under five seconds.",
    },
    {
      n: 2,
      title: "Real macros, not rounded guesses",
      body:
        "Every ingredient gets matched against USDA, Open Food Facts, and FatSecret. Ambiguous ingredients show a confidence score so you can verify before saving.",
    },
    {
      n: 3,
      title: "Plan weeks that hit your targets",
      body:
        "Build plans from your saved recipes and Suppr picks combinations that land on your macro targets. Generate a shopping list, then cook.",
    },
    {
      n: 4,
      title: "Adapts to how you actually eat",
      body:
        "Apple Health sync keeps your calorie target honest as activity shifts. Adaptive TDEE learns your real maintenance over 14 days.",
    },
  ];

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
            Suppr doesn’t guess. Every ingredient is parsed and matched against verified nutrition
            databases, so your meals, plans, and progress are built on real numbers — not an average.
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
          {steps.map((s) => (
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
      iconBg: "rgba(76,108,224,0.12)",
      iconColor: "#4c6ce0",
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
      iconBg: "rgba(34,168,96,0.12)",
      iconColor: "#22a860",
      Icon: Flame,
      title: "Macro tracking",
      body:
        "Every ingredient checked against USDA. Calories, protein, carbs, fat, fiber, sodium, sugar — all present, all honest.",
      meta: [
        { Icon: Database, text: "USDA + OFF" },
        { Icon: Activity, text: "Confidence scores" },
      ],
    },
    {
      iconBg: "rgba(232,160,32,0.12)",
      iconColor: "#e8a020",
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
      iconBg: "rgba(224,72,136,0.12)",
      iconColor: "#e04888",
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
        <aside className="lp-ws-side">
          <div className="lp-ws-brand">
            <div className="lp-mk">S</div>
            <div className="lp-n">Suppr</div>
          </div>
          <div className="lp-ws-cat">Track</div>
          <a className="lp-active">
            <Home aria-hidden />
            Today
          </a>
          <a>
            <CalendarDays aria-hidden />
            Plan
          </a>
          <a>
            <TrendingUp aria-hidden />
            Progress
          </a>
          <div className="lp-ws-cat">Recipes</div>
          <a>
            <BookOpen aria-hidden />
            Library
          </a>
          <a>
            <Compass aria-hidden />
            Discover
          </a>
          <a>
            <ShoppingCart aria-hidden />
            Shopping
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
                    stroke="#22a860"
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
                <WsMeta label="Burned" value="2,180" detail="Apple Health" />
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
                iconBg="rgba(34,168,96,0.15)"
                iconColor="#22a860"
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
                iconBg="rgba(76,108,224,0.15)"
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
                iconBg="rgba(232,160,32,0.15)"
                iconColor="#e8a020"
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
          <div className="lp-rm-item lp-now">
            <div className="lp-rm-dot">
              <Check width={12} height={12} aria-hidden style={{ color: "#fff" }} />
            </div>
            <div className="lp-rm-body">
              <div className="lp-rm-head">
                <h3>Now</h3>
                <span className="lp-rm-badge lp-now">In your app</span>
                <span className="lp-rm-when">v1.4 · May 2026</span>
              </div>
              <p>The core loop is shipped and stable on web, with the iOS app in TestFlight beta.</p>
              <div className="lp-rm-ships">
                <Ship done text="Recipe import from any recipe site, Instagram, TikTok, YouTube" />
                <Ship done text="Macro tracking with confidence scores" />
                <Ship done text="Meal planner with shopping list" />
                <Ship done text="Cook mode with step highlighting and inline timers" />
                <Ship done text="Apple Health sync + adaptive TDEE" />
              </div>
            </div>
          </div>

          <div className="lp-rm-item lp-next">
            <div className="lp-rm-dot" />
            <div className="lp-rm-body">
              <div className="lp-rm-head">
                <h3>Next</h3>
                <span className="lp-rm-badge lp-next">Building now</span>
                <span className="lp-rm-when">Q3 2026</span>
              </div>
              <p>The features rolling out to Pro tier over the next quarter.</p>
              <div className="lp-rm-ships">
                <Ship progress text="AI photo meal recognition (beta in TestFlight)" />
                <Ship progress text='Voice food logging ("log two eggs and toast")' />
                <Ship progress text="Recipe publishing with creator analytics" />
                <Ship text="Barcode scanning for packaged foods" />
                <Ship text="Home screen widgets (iOS 18 + Android)" />
              </div>
            </div>
          </div>

          <div className="lp-rm-item lp-later">
            <div className="lp-rm-dot" />
            <div className="lp-rm-body">
              <div className="lp-rm-head">
                <h3>Later</h3>
                <span className="lp-rm-badge lp-later">On the board</span>
                <span className="lp-rm-when">2026 · 2027</span>
              </div>
              <p>Bigger bets we’re designing, pending research and your feedback.</p>
              <div className="lp-rm-ships">
                <Ship text="Wear OS and Apple Watch cook-mode companion" />
                <Ship text="Grocery delivery integrations (Instacart, Amazon Fresh)" />
                <Ship text="Recipe Q&A with your own saved library" />
                <Ship text="Household sharing — plan meals across 2+ people" />
                <Ship text="Garmin, Fitbit, Whoop integrations" />
              </div>
            </div>
          </div>
        </div>

        <p style={{ textAlign: "center", fontSize: 13, color: "var(--lp-fg-muted)", marginTop: 32 }}>
          Questions about a feature? Every Pro subscriber gets a monthly roadmap email with direct
          reply.
        </p>
      </div>
    </section>
  );
}

function Ship({ done, progress, text }: { done?: boolean; progress?: boolean; text: string }) {
  const cls = ["lp-rm-ship", done ? "lp-done" : "", progress ? "lp-progress" : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls}>
      <div className="lp-c">{done ? <Check width={10} height={10} aria-hidden /> : null}</div>
      <div className="lp-txt">{text}</div>
    </div>
  );
}

/* ─────────────── Pricing ─────────────── */
function Pricing() {
  const tiers = [
    {
      name: "Free",
      hero: false,
      tag: "Track meals and see verified macros.",
      price: "$0",
      per: "forever",
      cta: { label: "Continue for free", primary: false },
      featHead: undefined,
      features: [
        "Save up to 10 recipes",
        "Browse community recipes",
        "Basic nutrition logging",
        "Daily macro tracking",
        "USDA food search",
        "Profile & target setup",
      ],
    },
    {
      name: "Base",
      hero: true,
      tag: "The full meal planning loop.",
      price: "$5",
      per: "/ month",
      cta: { label: "Upgrade to Base", primary: true },
      featHead: "Everything in Free, plus",
      features: [
        "Unlimited saved recipes",
        "Meal plans from your saved recipes",
        "Plans matched to your macro targets",
        "Shopping list from plan",
        "Cook mode with timers",
        "Recipe import from URL",
        "Barcode scanning",
        "Fiber & water tracking",
        "Export data (CSV)",
      ],
    },
    {
      name: "Pro",
      hero: false,
      tag: "Publish recipes and automate your targets.",
      price: "$12",
      per: "/ month",
      cta: { label: "Upgrade to Pro", primary: false },
      featHead: "Everything in Base, plus",
      features: [
        "AI photo meal recognition",
        "Voice food logging",
        "Publish recipes publicly",
        "Creator analytics",
        "Activity-adjusted calories",
        "Adaptive TDEE",
        "Macro trend reports",
        "Direct support response",
      ],
    },
  ];

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
          {tiers.map((t) => (
            <div className={`lp-tier${t.hero ? " lp-tier-hero" : ""}`} key={t.name}>
              <h3>{t.name}</h3>
              <p className="lp-tag">{t.tag}</p>
              <div className="lp-price-row">
                <span className="lp-price">{t.price}</span>
                <span className="lp-per">{t.per}</span>
              </div>
              <div className="lp-tier-btn">
                <Link
                  className={`lp-btn ${t.cta.primary ? "lp-btn-primary" : "lp-btn-ghost"}`}
                  href={SIGNUP_HREF}
                >
                  {t.cta.label}
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
          ))}
        </div>
        <div className="lp-pricing-trust">
          <span>
            <Shield width={14} height={14} aria-hidden style={{ color: "#22a860" }} />
            Cancel anytime
          </span>
          <span>
            <Cloud width={14} height={14} aria-hidden style={{ color: "var(--primary)" }} />
            Cloud sync across devices
          </span>
          <span>
            <Download width={14} height={14} aria-hidden style={{ color: "#e04888" }} />
            Export your data anytime
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
            </ul>
          </div>
        </div>
        <div className="lp-f-bottom">
          <div>© {new Date().getFullYear()} Suppr, Inc. All rights reserved.</div>
          <div className="lp-legal">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </div>
        </div>
        <p className="lp-f-disclaimer">
          Suppr is a personal tracking tool, not a medical device. Values are estimates; actual
          nutrition varies by preparation method, brand, and portion size. TDEE estimates use the
          Mifflin-St Jeor equation with an activity multiplier you set. Consult a clinician for
          medical advice.
        </p>
      </div>
    </footer>
  );
}
