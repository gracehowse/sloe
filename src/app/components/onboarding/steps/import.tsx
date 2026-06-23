"use client";

import * as React from "react";
import { Check, Globe, Instagram, Link2, Music } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { useOnboarding } from "../context";
import { StepBody, StepHeader, useStepOverline } from "../scaffold";
import type { ImportSource } from "@/lib/onboarding/state";

/**
 * Import — step 13. The "show, don't tell" close to the flow: paste a
 * link or pick a source, watch the parser do its thing.
 *
 * The actual recipe-import handshake is wired by Stage E (it routes
 * through the existing `recipeImportPipeline`). This step is the
 * presentation layer + a state-machine for the parsing demo.
 */

type Phase = "idle" | "parsing" | "done";

export function ImportStep() {
  const { state, set } = useOnboarding();
  const overline = useStepOverline();
  const [url, setUrl] = React.useState("");
  const [phase, setPhase] = React.useState<Phase>("idle");

  const runImport = (src: ImportSource) => {
    set({ importSource: src });
    setPhase("parsing");
    // Simulated parse latency. Stage E will replace this with the real
    // pipeline call (recipeImportPipeline.parseUrl(...)).
    const t = setTimeout(() => setPhase("done"), 2200);
    return () => clearTimeout(t);
  };

  return (
    <StepBody>
      <StepHeader
        overline={overline}
        title="Try importing a recipe"
        subtitle="Paste a link or pick a source — Sloe parses ingredients and matches each against USDA / Open Food Facts."
      />

      {phase === "idle" && (
        <>
          <div className="mb-4">
            <UrlField value={url} onChange={setUrl} />
          </div>
          <Button
            size="lg"
            variant="secondary"
            className="w-full h-12"
            onClick={() => runImport("instagram")}
          >
            {url ? "Import this recipe" : "Try a sample recipe"}
          </Button>

          <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground mt-5 mb-2.5">
            Or pick a source
          </div>
          <div className="grid grid-cols-3 gap-2">
            <SourceTile
              name="Instagram"
              icon={<Instagram className="size-5" />}
              onClick={() => runImport("instagram")}
            />
            <SourceTile
              name="TikTok"
              icon={<Music className="size-5" />}
              onClick={() => runImport("tiktok")}
            />
            <SourceTile
              name="Any blog"
              icon={<Globe className="size-5" />}
              onClick={() => runImport("blog")}
            />
          </div>
        </>
      )}

      {phase === "parsing" && <ImportParsing />}
      {phase === "done" && <ImportDone source={state.importSource} />}
    </StepBody>
  );
}

function UrlField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block bg-card border border-border rounded-md px-3.5 py-2.5 transition-pm focus-within:border-primary">
      <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground mb-1">
        Recipe URL
      </div>
      <div className="flex items-center gap-1.5">
        <Link2 className="size-3.5 text-muted-foreground" />
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://www.instagram.com/reel/…"
          className="flex-1 bg-transparent border-0 outline-none text-base font-medium text-foreground placeholder:text-muted-foreground/60"
        />
      </div>
    </label>
  );
}

function SourceTile({
  name,
  icon,
  onClick,
}: {
  name: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-card border border-border rounded-xl p-4 cursor-pointer flex flex-col items-center gap-2 text-foreground transition-pm hover:border-primary/40"
    >
      <span className="text-muted-foreground">{icon}</span>
      <div className="text-xs font-semibold">{name}</div>
    </button>
  );
}

function ImportParsing() {
  const steps = [
    "Fetching recipe…",
    "Parsing ingredients with natural-language model",
    "Matching against USDA food database",
    "Calculating macros and confidence",
  ];
  const [cur, setCur] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(
      () => setCur((c) => Math.min(steps.length - 1, c + 1)),
      500,
    );
    return () => clearInterval(id);
    // steps is a stable literal, fine to leave off deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="bg-card border border-border rounded-xl p-5 text-center">
      <div className="size-15 mx-auto mb-4 rounded-full border-[3px] border-border border-t-primary animate-spin" />
      <div className="text-[15px] font-bold text-foreground mb-4">
        Importing your recipe
      </div>
      <div className="text-left max-w-[280px] mx-auto">
        {steps.map((s, i) => (
          <div
            key={i}
            className={`flex gap-2.5 items-center py-1.5 transition-opacity ${
              i <= cur ? "opacity-100" : "opacity-35"
            }`}
          >
            {i < cur ? (
              <Check
                className="size-3.5 text-success"
                strokeWidth={2.5}
              />
            ) : (
              <div
                className={`size-3.5 rounded-full border-[1.5px] ${
                  i === cur
                    ? "border-primary bg-primary/20"
                    : "border-input"
                }`}
              />
            )}
            <span
              className={`text-xs ${
                i <= cur ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {s}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ImportDone({ source }: { source: ImportSource }) {
  const src =
    source === "tiktok"
      ? "tiktok.com"
      : source === "blog"
        ? "seriouseats.com"
        : "instagram.com";
  return (
    <div className="bg-card border border-success/30 rounded-xl overflow-hidden">
      <div
        className="aspect-[16/9] grid place-items-center relative"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in oklab, var(--card) 50%, #000) 0%, var(--input-background) 50%, color-mix(in oklab, var(--card) 50%, #000) 100%)",
        }}
      >
        <div className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground/60 font-semibold">
          recipe photo
        </div>
        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-card/80 backdrop-blur px-2.5 py-1 rounded-full text-[11px] font-semibold text-foreground border border-border">
          <Link2 className="size-3 text-primary" />
          {src}
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-success mb-2">
          <Check className="size-3.5" strokeWidth={2.5} />
          Example · matched against USDA
        </div>
        <div className="text-[18px] font-bold text-foreground tracking-tight mb-1">
          Sheet-pan chicken with roasted peppers
        </div>
        <div className="text-xs text-muted-foreground mb-3.5">
          4 servings · 32 min
        </div>
        <div className="grid grid-cols-4 gap-2 border-t border-border pt-3.5">
          <MiniStat n="620" u="kcal" c="text-success" />
          <MiniStat n="48" u="P g" c="text-primary" />
          <MiniStat n="52" u="C g" c="text-warning-solid" />
          <MiniStat n="22" u="F g" c="text-macro-fat" />
        </div>
      </div>
    </div>
  );
}

function MiniStat({ n, u, c }: { n: string; u: string; c: string }) {
  return (
    <div>
      <div className="text-[15px] font-bold text-foreground tabular-nums tracking-tight">
        {n}
      </div>
      <div
        className={`text-[10px] font-semibold uppercase tracking-[0.08em] mt-0.5 ${c}`}
      >
        {u}
      </div>
    </div>
  );
}
