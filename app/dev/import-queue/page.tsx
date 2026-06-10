"use client";

/**
 * Import-progress staged-progress + queue drawer — visual validation harness
 * (ENG, 2026-06-08). Renders the REAL `RecipeImportQueueDrawer` against
 * isolated, seeded `RecipeImportScheduler` instances so Playwright (or Grace)
 * can screenshot every state — queued, mid-stage, done, retryable failure,
 * non-retryable failure — without auth or live imports.
 *
 * Mock data only, no PII. Production exposure is blocked by the Vercel
 * `/dev/*` route block (same posture as the other `/dev/` harnesses).
 *
 * The drawer is `position: fixed`; each frame sets `transform: translateZ(0)`
 * to become the containing block so the drawer anchors INSIDE the frame
 * rather than the viewport — letting all states render side by side.
 */
import * as React from "react";
import { RecipeImportQueueDrawer } from "@/app/components/suppr/recipe-import-queue-drawer";
import { useImportQueue } from "@/lib/recipes/useImportQueue";
import {
  RecipeImportScheduler,
  ImportRunnerError,
  type ImportRunnerControls,
  type ImportStage,
} from "@/lib/recipes/recipeImportScheduler";

type Seed =
  | { id: string; kind: "url" | "image" | "caption"; title: string; park: Exclude<ImportStage, "queued" | "done" | "cancelled" | "failed"> }
  | { id: string; kind: "url" | "image" | "caption"; title: string; done: true; recipeId?: string }
  | { id: string; kind: "url" | "image" | "caption"; title: string; fail: ImportRunnerError["code"] }
  | { id: string; kind: "url" | "image" | "caption"; title: string; queued: true };

function parkedRunner(target: Exclude<ImportStage, "queued" | "done" | "cancelled" | "failed">) {
  return (controls: ImportRunnerControls): Promise<{ title?: string }> => {
    if (target === "extracting" || target === "organizing") controls.setStage("extracting");
    if (target === "organizing") controls.setStage("organizing");
    return new Promise(() => {}); // parked for the screenshot
  };
}

function Frame({ label, note, seeds, concurrency }: { label: string; note: string; seeds: Seed[]; concurrency: number }) {
  const scheduler = React.useMemo(() => new RecipeImportScheduler({ concurrency }), [concurrency]);
  const queue = useImportQueue("web", undefined, scheduler);
  const seeded = React.useRef(false);

  React.useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    for (const s of seeds) {
      if ("done" in s) {
        scheduler.enqueue({ id: s.id, kind: s.kind, title: s.title, run: async () => ({ title: s.title, recipeId: s.recipeId ?? null }) });
      } else if ("fail" in s) {
        scheduler.enqueue({ id: s.id, kind: s.kind, title: s.title, run: async () => { throw new ImportRunnerError(s.fail); } });
      } else if ("queued" in s) {
        scheduler.enqueue({ id: s.id, kind: s.kind, title: s.title, run: parkedRunner("extracting") });
      } else {
        scheduler.enqueue({ id: s.id, kind: s.kind, title: s.title, run: parkedRunner(s.park) });
      }
    }
  }, [scheduler, seeds]);

  return (
    <div
      data-testid={`frame-${label}`}
      className="rounded-card border border-border bg-card p-4"
      style={{ position: "relative", transform: "translateZ(0)", minHeight: 320, overflow: "hidden" }}
    >
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
      <p className="text-[11px] text-muted-foreground mb-2">{note}</p>
      <RecipeImportQueueDrawer queue={queue} onOpenRecipe={() => {}} />
    </div>
  );
}

export default function ImportQueueHarnessPage() {
  return (
    <main className="min-h-screen bg-background text-foreground p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <h1 className="text-2xl font-bold">Import-progress staged-progress + queue — visual validation</h1>
          <p className="text-sm text-muted-foreground mt-1">
            The web persistent import-queue drawer (`import-progress-v2`). Each frame seeds an isolated
            scheduler in a fixed state. Calm Sloe register; per-stage rail; per-recipe cancel/retry.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Frame
            label="Single — extracting"
            note="One URL import, the long server leg. Indeterminate spinner + stage rail."
            concurrency={2}
            seeds={[{ id: "a", kind: "url", title: "smittenkitchen.com", park: "extracting" }]}
          />
          <Frame
            label="Queue with backlog"
            note="Two active + one queued (#1). 'Importing 2 · 1 in queue'."
            concurrency={2}
            seeds={[
              { id: "a", kind: "url", title: "Charred broccoli pasta", park: "organizing" },
              { id: "b", kind: "caption", title: "TikTok reel", park: "extracting" },
              { id: "c", kind: "url", title: "bbcgoodfood.com", queued: true },
            ]}
          />
          <Frame
            label="Mixed terminal states"
            note="Done (tap to open) + retryable failure (timeout) + one in flight."
            concurrency={2}
            seeds={[
              { id: "a", kind: "url", title: "Miso butter salmon", done: true, recipeId: "rec-1" },
              { id: "b", kind: "url", title: "seriouseats.com", fail: "timeout" },
              { id: "c", kind: "image", title: "Recipe photo", park: "extracting" },
            ]}
          />
          <Frame
            label="Non-retryable failure"
            note="Bad link — no Retry, only Dismiss. Reuses importErrorCopy."
            concurrency={2}
            seeds={[{ id: "a", kind: "url", title: "not-a-recipe.com", fail: "no_recipe_extracted" }]}
          />
        </div>
      </div>
    </main>
  );
}
