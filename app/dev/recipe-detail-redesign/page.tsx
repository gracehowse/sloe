"use client";

/**
 * Recipe detail — BEFORE / AFTER side-by-side prototype for the
 * 2026-05-05 polish-patch spec. Lives at /dev/recipe-detail-redesign.
 *
 * Renders mock data only — no PII, no fetch. Production exposure
 * blocked by the /dev/* middleware gate (VERCEL_ENV).
 *
 * Each frame is iPhone 14 Pro logical viewport (393×852) so the
 * comparison matches what ships on mobile. The 6 changes (C1–C6)
 * are highlighted in the AFTER frame with a small marker.
 */

import * as React from "react";
import {
  ArrowLeft,
  Bookmark,
  Share2,
  MoreHorizontal,
  Pencil,
  Sparkles,
  Wheat,
  Droplet,
  Leaf,
} from "lucide-react";

const ACCENT = "#5B5FE9";
const DARK = "#0F1115";
const SUB = "#5B6168";
const BORDER = "#E5E7EB";
const BG = "#F4F5F7";
const SUCCESS = "#22a860";
const PROTEIN = "#5B5FE9";
const CARBS = "#C9A45B";
const FAT = "#E04848";
const FIBER = "#3FA67A";

type Diff = "C1" | "C2" | "C3" | "C4" | "C5" | "C6";

function DiffPill({ id }: { id: Diff }) {
  return (
    <span
      className="ml-1 inline-flex h-[18px] items-center rounded-full px-1.5 text-[10px] font-bold uppercase tracking-wider text-white"
      style={{ background: SUCCESS }}
    >
      {id}
    </span>
  );
}

function PhoneFrame({
  label,
  children,
  variant,
}: {
  label: string;
  children: React.ReactNode;
  variant: "before" | "after";
}) {
  return (
    <div className="flex flex-col items-center">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
          style={{ background: variant === "after" ? SUCCESS : "#71717A" }}
        >
          {variant}
        </span>
      </div>
      <div
        className="overflow-hidden rounded-[44px] border-[8px] border-zinc-900 shadow-2xl"
        style={{ width: 393, height: 852 }}
      >
        <div className="relative h-full w-full" style={{ background: BG }}>
          {/* Status bar */}
          <div className="absolute inset-x-0 top-0 z-50 flex h-[44px] items-center justify-between px-7 text-[14px] font-semibold text-black">
            <span>9:41</span>
            <span className="absolute left-1/2 top-2 h-[28px] w-[120px] -translate-x-1/2 rounded-full bg-black" />
            <span>􀙇 􀛨</span>
          </div>
          <div
            className="absolute inset-x-0 top-[44px] bottom-0 overflow-y-auto"
            style={{ background: BG }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function StickyTopBar() {
  return (
    <div className="sticky top-0 z-40 flex items-center justify-between bg-zinc-50/95 px-4 py-3 backdrop-blur">
      <button className="flex h-9 w-9 items-center justify-center">
        <ArrowLeft size={20} />
      </button>
      <span className="flex-1 truncate px-3 text-[15px] font-semibold" style={{ color: DARK }}>
        Spicy Feta Chicken Crunch
      </span>
      <div className="flex items-center gap-1">
        <button className="flex h-9 w-9 items-center justify-center">
          <Bookmark size={20} fill={SUCCESS} stroke={SUCCESS} />
        </button>
        <button className="flex h-9 w-9 items-center justify-center">
          <Share2 size={20} />
        </button>
        <button className="flex h-9 w-9 items-center justify-center">
          <MoreHorizontal size={20} />
        </button>
      </div>
    </div>
  );
}

function MacroTile({
  label,
  value,
  unit,
  target,
  color,
  Icon,
  pct,
  variant,
}: {
  label: string;
  value: string;
  unit: string;
  target: number;
  color: string;
  Icon: import("lucide-react").LucideIcon;
  pct: number;
  variant: "before" | "after";
}) {
  return (
    <div
      className="rounded-[16px] bg-white p-3"
      style={{ border: `1px solid ${BORDER}` }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: SUB }}>
          {label}
        </span>
        <Icon size={14} color={color} />
      </div>
      <p className="mt-1.5 text-[20px] font-bold leading-none" style={{ color: DARK }}>
        {value}
        <span className="text-[12px] font-normal" style={{ color: SUB }}>
          {unit}
        </span>
      </p>
      {/* C6: caption demoted in AFTER */}
      <p
        className="mt-1"
        style={{
          color: SUB,
          fontSize: variant === "after" ? 9 : 11,
          opacity: variant === "after" ? 0.6 : 1,
        }}
      >
        of {target}
        {variant === "before" ? unit : ""}
      </p>
      <div className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-zinc-100">
        <div className="h-full rounded-full" style={{ width: `${pct * 100}%`, background: color }} />
      </div>
    </div>
  );
}

function GradientFallback({ height }: { height: number }) {
  return (
    <div
      style={{
        height,
        background:
          "linear-gradient(135deg, #BBC6FF 0%, #C8B5FF 35%, #F0AECF 70%, #FFCFBA 100%)",
      }}
      className="flex items-center justify-center"
    >
      <Sparkles size={28} color="#fff" style={{ opacity: 0.6 }} />
    </div>
  );
}

function StockHero() {
  // Mimic the DEFAULT_IMAGE Unsplash fallback at 280pt — flat slate
  // the real screen shows when no recipe image is available.
  return (
    <div
      style={{
        height: 280,
        background:
          "linear-gradient(180deg, #E4E5EA 0%, #DBDDE3 100%)",
      }}
      className="flex items-center justify-center"
    >
      <span className="text-[11px] uppercase tracking-widest" style={{ color: SUB, opacity: 0.6 }}>
        stock photo (DEFAULT_IMAGE)
      </span>
    </div>
  );
}

function BeforeFrame() {
  return (
    <PhoneFrame label="Recipe detail — current" variant="before">
      <StickyTopBar />
      <StockHero />
      <div className="px-4 py-4">
        <h1 className="text-[24px] font-bold leading-tight" style={{ color: DARK }}>
          Spicy Feta Chicken Crunch
        </h1>
        <span
          className="mt-2 inline-flex h-5 items-center rounded-full px-2 text-[10px] font-bold uppercase tracking-wider"
          style={{ background: "#F1F1F4", color: SUB }}
        >
          GF
        </span>
        <p className="mt-2 text-[17px] font-semibold tabular-nums" style={{ color: DARK }}>
          235 kcal <span style={{ color: SUB, fontWeight: 400 }}>· per portion</span>
        </p>
        <p className="text-[13px]" style={{ color: SUB }}>
          lunch · serves 3 · by emthenutritionist
        </p>

        <button
          className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold"
          style={{ color: ACCENT }}
        >
          ✎ Edit servings
        </button>

        <div
          className="mt-3 flex items-center justify-between rounded-[16px] bg-white p-3"
          style={{ border: `1px solid ${BORDER}` }}
        >
          <span className="text-[14px] font-medium" style={{ color: DARK }}>
            Servings to view
          </span>
          <div className="flex items-center gap-3">
            <button
              className="flex h-8 w-8 items-center justify-center rounded-full"
              style={{ border: `1px solid ${BORDER}` }}
            >
              −
            </button>
            <span className="text-[16px] font-bold tabular-nums" style={{ color: DARK }}>
              3
            </span>
            <button
              className="flex h-8 w-8 items-center justify-center rounded-full"
              style={{ border: `1px solid ${BORDER}` }}
            >
              +
            </button>
          </div>
        </div>

        {/* mid-page percentage pill — duplicate of footer */}
        <div className="mt-3 flex justify-center">
          <span
            className="rounded-full px-3 py-1 text-[12px] font-semibold"
            style={{ background: "#EEF0FF", color: ACCENT }}
          >
            ≈ 20% of your day
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <MacroTile label="Protein" value="24" unit="g" target={122} color={PROTEIN} Icon={Sparkles} pct={0.2} variant="before" />
          <MacroTile label="Carbs" value="10" unit="g" target={91} color={CARBS} Icon={Wheat} pct={0.11} variant="before" />
          <MacroTile label="Fat" value="10" unit="g" target={31} color={FAT} Icon={Droplet} pct={0.32} variant="before" />
          <MacroTile label="Fiber" value="1.7" unit="g" target={16} color={FIBER} Icon={Leaf} pct={0.1} variant="before" />
        </div>

        <p className="mt-3 text-[13px] font-semibold" style={{ color: SUCCESS }}>
          ✓ Fits your day · ≈ 20%
        </p>

        <div
          className="mt-3 rounded-[12px] p-3"
          style={{ background: "#FFF7E6", border: `1px solid #F5DCA1` }}
        >
          <p className="text-[12px] font-semibold" style={{ color: "#92560B" }}>
            Contains: dairy, gluten
          </p>
        </div>
      </div>
    </PhoneFrame>
  );
}

function AfterFrame() {
  return (
    <PhoneFrame label="Recipe detail — patched" variant="after">
      <StickyTopBar />
      {/* C1: gradient fallback at 140pt instead of 280pt stock photo */}
      <div className="relative">
        <GradientFallback height={140} />
        <span className="absolute right-2 top-2">
          <DiffPill id="C1" />
        </span>
      </div>
      <div className="px-4 py-4">
        <h1 className="text-[24px] font-bold leading-tight" style={{ color: DARK }}>
          Spicy Feta Chicken Crunch
        </h1>
        <span
          className="mt-2 inline-flex h-5 items-center rounded-full px-2 text-[10px] font-bold uppercase tracking-wider"
          style={{ background: "#F1F1F4", color: SUB }}
        >
          GF
        </span>
        <p className="mt-2 text-[17px] font-semibold tabular-nums" style={{ color: DARK }}>
          235 kcal <span style={{ color: SUB, fontWeight: 400 }}>· per portion</span>
        </p>
        {/* C5: drop "serves 3" from subtitle */}
        <p className="text-[13px]" style={{ color: SUB }}>
          lunch · by emthenutritionist
          <DiffPill id="C5" />
        </p>

        {/* C3: pencil icon replaces the "Edit servings" text link */}
        <div
          className="mt-3 flex items-center justify-between rounded-[16px] bg-white p-3"
          style={{ border: `1px solid ${BORDER}` }}
        >
          <span className="flex items-center gap-1 text-[14px] font-medium" style={{ color: DARK }}>
            {/* C4: "Servings to view" → "Servings" */}
            Servings
            <DiffPill id="C4" />
          </span>
          <div className="flex items-center gap-3">
            <button
              className="flex h-8 w-8 items-center justify-center rounded-full"
              style={{ border: `1px solid ${BORDER}` }}
            >
              −
            </button>
            <span className="text-[16px] font-bold tabular-nums" style={{ color: DARK }}>
              3
            </span>
            <button
              className="flex h-8 w-8 items-center justify-center rounded-full"
              style={{ border: `1px solid ${BORDER}` }}
            >
              +
            </button>
            <button
              className="flex h-8 w-8 items-center justify-center rounded-full"
              style={{ border: `1px solid ${BORDER}` }}
              aria-label="Edit recipe yield"
            >
              <Pencil size={14} style={{ color: SUB }} />
            </button>
            <DiffPill id="C3" />
          </div>
        </div>

        {/* C2: mid-page pill removed (footer keeps the %) */}

        {/* C6: macro tile caption demoted */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <MacroTile label="Protein" value="24" unit="g" target={122} color={PROTEIN} Icon={Sparkles} pct={0.2} variant="after" />
          <MacroTile label="Carbs" value="10" unit="g" target={91} color={CARBS} Icon={Wheat} pct={0.11} variant="after" />
          <MacroTile label="Fat" value="10" unit="g" target={31} color={FAT} Icon={Droplet} pct={0.32} variant="after" />
          <MacroTile label="Fiber" value="1.7" unit="g" target={16} color={FIBER} Icon={Leaf} pct={0.1} variant="after" />
        </div>
        <span className="ml-1 mt-1 inline-flex"><DiffPill id="C6" /></span>

        <p className="mt-3 text-[13px] font-semibold" style={{ color: SUCCESS }}>
          ✓ Fits your day · ≈ 20%
          <span className="ml-1 inline-flex"><DiffPill id="C2" /></span>
        </p>

        <div
          className="mt-3 rounded-[12px] p-3"
          style={{ background: "#FFF7E6", border: `1px solid #F5DCA1` }}
        >
          <p className="text-[12px] font-semibold" style={{ color: "#92560B" }}>
            Contains: dairy, gluten
          </p>
        </div>
      </div>
    </PhoneFrame>
  );
}

export default function RecipeDetailRedesignPage() {
  return (
    <main className="min-h-screen bg-zinc-50 p-6 lg:p-10">
      <div className="mx-auto max-w-[1100px]">
        <header className="mb-8">
          <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
            Recipe detail · 2026-05-05
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Polish patch — before vs after</h1>
          <p className="mt-2 max-w-3xl text-[14px] text-zinc-600">
            Side-by-side at iPhone 14 Pro logical viewport (393×852). 6 contained
            changes (C1–C6), no new components, no rebuild. The "C#" green pills
            mark each change in the AFTER frame.
          </p>
        </header>
        <div className="flex flex-row justify-center gap-10">
          <BeforeFrame />
          <AfterFrame />
        </div>
        <section className="mx-auto mt-12 max-w-3xl text-[13px] text-zinc-700">
          <h2 className="mb-3 text-xl font-bold">The 6 changes</h2>
          <ul className="space-y-2 list-disc pl-5">
            <li>
              <strong>C1.</strong> When no image, replace the 280pt Unsplash stock photo with the deterministic <code>RecipeHeroFallback</code> gradient at 140pt — the same component the Library card already uses. Photo-present case stays at 280pt.
            </li>
            <li>
              <strong>C2.</strong> Cut the mid-page <em>≈ 20% of your day</em> pill. The footer line <em>✓ Fits your day · ≈ 20%</em> is now the single source of truth for the percentage.
            </li>
            <li>
              <strong>C3.</strong> Replace the <em>Edit servings</em> text link (above the stepper) with a small pencil icon on the stepper card's right edge. Owner-only, opens the same yield editor.
            </li>
            <li>
              <strong>C4.</strong> <em>Servings to view</em> → <em>Servings</em>. Stepper context makes "to view" implicit; the pencil is the disambiguator.
            </li>
            <li>
              <strong>C5.</strong> Drop <em>serves 3</em> from the subtitle. The stepper IS the source of truth for servings; saying it twice is noise.
            </li>
            <li>
              <strong>C6.</strong> Demote macro-tile <em>of 122g</em> caption to 9pt at 0.6 opacity, and drop the redundant unit suffix on the cap line (the value line above already shows it). Removes 4 noisy repeats.
            </li>
          </ul>
          <h2 className="mb-3 mt-8 text-xl font-bold">Hard NO list</h2>
          <ul className="space-y-2 list-disc pl-5">
            <li>No macro chip strip above the 2x2 tiles (would duplicate, same trap as the C1 mockups).</li>
            <li>No second log-from-recipe CTA (Log lunch on planner already, +FAB elsewhere).</li>
            <li>No new percent pill, ring, or progress glyph anywhere on this screen.</li>
            <li>No eyebrow chip / category badge / source-confidence chip resurrection.</li>
            <li>No background colour change, no token churn, no premium-feel rework of the bones.</li>
          </ul>
          <h2 className="mb-3 mt-8 text-xl font-bold">Web parity</h2>
          <p>
            Web public recipe page picks up <strong>C1 only</strong> — replace the same Unsplash fallback with a CSS gradient block when <code>image_url</code> is null. Stepper, owner controls, and the percentage line don't exist on the public web page (no auth user). Sync-enforcer carve-out documented.
          </p>
          <h2 className="mb-3 mt-8 text-xl font-bold">Estimate</h2>
          <p>
            ~30–60 LOC mobile + ~5 LOC web + 2–3 unit tests + one Maestro screenshot diff. Single small PR.
          </p>
        </section>
      </div>
    </main>
  );
}
