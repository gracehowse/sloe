"use client";

/**
 * Phase 1 primitives preview page.
 *
 * Local-only showcase for the three new primitives shipped in Phase 1
 * of the onboarding redesign — `SupprMark` / `SupprWordmark`,
 * `OptionCard`, and `RulerSlider`. Lives at `/dev/primitives`.
 *
 * This page exists so Grace can interact with the primitives on real
 * data + theming without waiting for Phase 2's onboarding rewrite.
 * Returns a 404 when `NODE_ENV === "production"` so it never ships to
 * end users — see `notFound()` guard at the top of the component.
 */

import * as React from "react";
import { notFound } from "next/navigation";
import {
  TrendingDown,
  Equal,
  TrendingUp,
  Shuffle,
  Footprints,
  Activity,
  Dumbbell,
  Flame,
  Armchair,
} from "lucide-react";
import { OptionCard } from "@/app/components/ui/option-card";
import { SupprMark, SupprWordmark } from "@/app/components/ui/suppr-mark";
import {
  RulerSlider,
  formatImperialHeightInches,
  parseImperialHeightInches,
} from "@/app/components/suppr/ruler-slider";

type Goal = "lose" | "maintain" | "gain" | "recomp";
type Activity = "sedentary" | "light" | "moderate" | "active" | "athlete";

const GOALS: { id: Goal; title: string; subtitle: string; icon: React.ReactNode }[] = [
  { id: "lose", title: "Lose fat", subtitle: "Gradual deficit, protein-first", icon: <TrendingDown className="size-5" /> },
  { id: "maintain", title: "Maintain", subtitle: "Keep things steady", icon: <Equal className="size-5" /> },
  { id: "gain", title: "Gain muscle", subtitle: "Small surplus, high protein", icon: <TrendingUp className="size-5" /> },
  { id: "recomp", title: "Recomposition", subtitle: "Slight cut, heavy training", icon: <Shuffle className="size-5" /> },
];

const ACTIVITIES: { id: Activity; title: string; subtitle: string; icon: React.ReactNode }[] = [
  { id: "sedentary", title: "Sedentary", subtitle: "Mostly sitting, little walking", icon: <Armchair className="size-4" /> },
  { id: "light", title: "Lightly active", subtitle: "1–3 workouts or active days / wk", icon: <Footprints className="size-4" /> },
  { id: "moderate", title: "Moderately active", subtitle: "3–5 sessions + daily movement", icon: <Activity className="size-4" /> },
  { id: "active", title: "Very active", subtitle: "6–7 sessions, physical job", icon: <Dumbbell className="size-4" /> },
  { id: "athlete", title: "Athlete", subtitle: "Twice-daily training, competitive", icon: <Flame className="size-4" /> },
];

const DIETS = ["Vegetarian", "Vegan", "Pescatarian", "Keto", "Mediterranean", "Anything"];

export default function PrimitivesPreview() {
  if (process.env.NODE_ENV === "production") notFound();

  const [theme, setTheme] = React.useState<"light" | "dark">("dark");
  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const [goal, setGoal] = React.useState<Goal>("lose");
  const [activity, setActivity] = React.useState<Activity>("moderate");
  const [diet, setDiet] = React.useState<string[]>(["Vegetarian"]);
  const toggleDiet = (d: string) =>
    setDiet((s) => (s.includes(d) ? s.filter((x) => x !== d) : [...s, d]));

  const [heightCm, setHeightCm] = React.useState(170);
  const [weightKg, setWeightKg] = React.useState(72);
  const [imperial, setImperial] = React.useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <SupprWordmark size={28} />
            <span className="hidden text-sm text-muted-foreground sm:inline">
              · Phase 1 primitives preview
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/onboarding/v2"
              className="rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition-pm hover:bg-primary/15"
            >
              See onboarding v2 →
            </a>
            <button
              type="button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold transition-pm hover:border-primary/40"
            >
              Theme: {theme}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-12 px-6 py-10">
        {/* Brand mark */}
        <Section
          title="SupprMark / SupprWordmark"
          subtitle="Brand mark as a React component. Always blue background + white S regardless of theme — the primary lift to brighter blue in dark mode happens through the --primary token."
        >
          <div className="flex flex-wrap items-end gap-10 rounded-card border border-border bg-card p-8">
            <Demo label="Mark · 24"><SupprMark size={24} /></Demo>
            <Demo label="Mark · 32"><SupprMark size={32} /></Demo>
            <Demo label="Mark · 48"><SupprMark size={48} /></Demo>
            <Demo label="Mark · 80"><SupprMark size={80} /></Demo>
            <Demo label="Wordmark · 28"><SupprWordmark size={28} /></Demo>
            <Demo label="Wordmark · 40"><SupprWordmark size={40} /></Demo>
          </div>
        </Section>

        {/* Goal — single select with icon */}
        <Section
          title="OptionCard — single select (Goal step)"
          subtitle="Default trailing radio circle, full-size cards, large icons. Selected state uses the primary tint + border."
        >
          <div className="grid gap-2.5 max-w-md">
            {GOALS.map((g) => (
              <OptionCard
                key={g.id}
                selected={goal === g.id}
                onClick={() => setGoal(g.id)}
                icon={g.icon}
                title={g.title}
                subtitle={g.subtitle}
              />
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Current: <code className="text-foreground">{goal}</code>
          </p>
        </Section>

        {/* Activity — compact single select */}
        <Section
          title="OptionCard — compact (Activity step)"
          subtitle="Same primitive with compact={true} for denser lists."
        >
          <div className="grid gap-2 max-w-md">
            {ACTIVITIES.map((a) => (
              <OptionCard
                key={a.id}
                compact
                selected={activity === a.id}
                onClick={() => setActivity(a.id)}
                icon={a.icon}
                title={a.title}
                subtitle={a.subtitle}
              />
            ))}
          </div>
        </Section>

        {/* Diet — multi-select with no trailing checkbox (chip-style) */}
        <Section
          title="OptionCard — multi-select chip variant (Diet step)"
          subtitle="Pass trailing={null} to suppress the radio circle; selected border + tint still communicate state."
        >
          <div className="grid grid-cols-2 gap-2 max-w-md">
            {DIETS.map((d) => (
              <OptionCard
                key={d}
                compact
                selected={diet.includes(d)}
                onClick={() => toggleDiet(d)}
                title={d}
                trailing={null}
              />
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Selected: <code className="text-foreground">{diet.join(", ") || "—"}</code>
          </p>
        </Section>

        {/* Ruler slider */}
        <Section
          title="RulerSlider — Height + Weight"
          subtitle="Drag to scrub, mouse-wheel to nudge, arrow keys for ±step, Page Up/Down for ±major, Home/End to clamp. Tap the big number to type a value."
        >
          <div className="mb-4 flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={() => setImperial((v) => !v)}
              className="rounded-md border border-border bg-card px-3 py-1.5 font-semibold transition-pm hover:border-primary/40"
            >
              Units: {imperial ? "imperial" : "metric"}
            </button>
            <span className="text-muted-foreground">
              State — height: <code className="text-foreground">{heightCm} cm</code> · weight:{" "}
              <code className="text-foreground">{weightKg.toFixed(1)} kg</code>
            </span>
          </div>
          <div className="grid gap-10 md:grid-cols-2">
            <div className="rounded-card border border-border bg-card p-6">
              <div className="section-label mb-4">Height</div>
              {imperial ? (
                <RulerSlider
                  value={Math.round(heightCm / 2.54)}
                  onChange={(totalIn) => setHeightCm(Math.round(totalIn * 2.54))}
                  min={48}
                  max={84}
                  step={1}
                  format={formatImperialHeightInches}
                  parseInput={parseImperialHeightInches}
                  ariaLabel="Height"
                />
              ) : (
                <RulerSlider
                  value={heightCm}
                  onChange={setHeightCm}
                  min={140}
                  max={210}
                  step={1}
                  unit="cm"
                  ariaLabel="Height"
                />
              )}
            </div>
            <div className="rounded-card border border-border bg-card p-6">
              <div className="section-label mb-4">Weight</div>
              {imperial ? (
                <RulerSlider
                  value={+(weightKg * 2.2046).toFixed(1)}
                  onChange={(lb) => setWeightKg(+(lb / 2.2046).toFixed(2))}
                  min={90}
                  max={330}
                  step={1}
                  unit="lb"
                  ariaLabel="Weight"
                />
              ) : (
                <RulerSlider
                  value={weightKg}
                  onChange={setWeightKg}
                  min={40}
                  max={150}
                  step={0.5}
                  decimals={1}
                  unit="kg"
                  ariaLabel="Weight"
                />
              )}
            </div>
          </div>
        </Section>

        <footer className="border-t border-border pt-6 text-xs text-muted-foreground">
          Phase 1 of the onboarding redesign · see{" "}
          <code className="text-foreground">
            docs/decisions/2026-04-19-onboarding-redesign-scope.md
          </code>{" "}
          for what's next.
        </footer>
      </main>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-xl font-bold tracking-tight">{title}</h2>
      {subtitle && (
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>
      )}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Demo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2">
      {children}
      <div className="section-label">{label}</div>
    </div>
  );
}
