import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useEffect, useMemo, useRef } from "react";

import { RecipeImportQueueDrawer } from "./recipe-import-queue-drawer";
import { useImportQueue } from "../../../lib/recipes/useImportQueue";
import {
  RecipeImportScheduler,
  ImportRunnerError,
  type ImportRunnerControls,
  type ImportStage,
} from "../../../lib/recipes/recipeImportScheduler";

/**
 * Import-progress staged-progress + queue drawer (ENG, 2026-06-08) — visual
 * proof of the web half of the Julienne import-UX borrow.
 *
 * The drawer is gated by `import-progress-v2` in the real app AND only shows
 * when there's live import activity, so it can't be screenshotted from the
 * authed app without (a) enabling the flag and (b) firing real imports
 * against live Supabase + the import API. These stories inject an ISOLATED
 * `RecipeImportScheduler` (not the app singleton) seeded with controllable
 * runners parked at each stage, so every state — queued, mid-stage,
 * done, failed/retryable — renders in the REAL component for pixel + a11y
 * review. No mocks of the drawer itself; only the network leg is stubbed.
 */

/** A runner that parks the job at `targetStage` forever (story keeps it visible). */
function parkedRunner(targetStage: Exclude<ImportStage, "queued" | "done" | "cancelled" | "failed">) {
  return (controls: ImportRunnerControls): Promise<{ title?: string }> => {
    if (targetStage === "extracting") controls.setStage("extracting");
    if (targetStage === "organizing") {
      controls.setStage("extracting");
      controls.setStage("organizing");
    }
    // Never resolves — the job stays at targetStage for the screenshot.
    return new Promise(() => {});
  };
}

type Seed =
  | { id: string; kind: "url" | "image" | "caption"; title: string; park: "confirming" | "extracting" | "organizing" }
  | { id: string; kind: "url" | "image" | "caption"; title: string; done: true; recipeId?: string }
  | { id: string; kind: "url" | "image" | "caption"; title: string; fail: ImportRunnerError["code"] }
  | { id: string; kind: "url" | "image" | "caption"; title: string; queued: true };

function DrawerHarness({ seeds, concurrency }: { seeds: Seed[]; concurrency: number }) {
  // One isolated scheduler per harness mount.
  const scheduler = useMemo(() => new RecipeImportScheduler({ concurrency }), [concurrency]);
  const queue = useImportQueue("web", undefined, scheduler);
  const seeded = useRef(false);

  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    for (const s of seeds) {
      if ("done" in s) {
        scheduler.enqueue({
          id: s.id,
          kind: s.kind,
          title: s.title,
          run: async () => ({ title: s.title, recipeId: s.recipeId ?? null }),
        });
      } else if ("fail" in s) {
        scheduler.enqueue({
          id: s.id,
          kind: s.kind,
          title: s.title,
          run: async () => {
            throw new ImportRunnerError(s.fail);
          },
        });
      } else if ("queued" in s) {
        // A never-resolving job that holds a slot, plus this queued one
        // behind it — handled by the per-story concurrency setting.
        scheduler.enqueue({ id: s.id, kind: s.kind, title: s.title, run: parkedRunner("extracting") });
      } else {
        scheduler.enqueue({ id: s.id, kind: s.kind, title: s.title, run: parkedRunner(s.park) });
      }
    }
  }, [scheduler, seeds]);

  return (
    <div style={{ minHeight: 520, position: "relative" }}>
      <RecipeImportQueueDrawer queue={queue} onOpenRecipe={() => {}} />
    </div>
  );
}

/** Inert queue stub — only satisfies the required `queue` prop type for
 *  Storybook's arg inference. Every story overrides `render` with the
 *  `DrawerHarness`, so this stub is never actually displayed. */
const STUB_QUEUE = {
  jobs: [],
  inFlight: [],
  recent: [],
  activeCount: 0,
  queuedCount: 0,
  failedCount: 0,
  summary: "",
  hasActivity: false,
  enqueue: () => false,
  cancel: () => {},
  retry: () => false,
  dismiss: () => {},
  clearFinished: () => {},
} as const;

const meta = {
  title: "Suppr/RecipeImportQueueDrawer",
  component: RecipeImportQueueDrawer,
  tags: ["ai-generated"],
  args: { queue: STUB_QUEUE },
  parameters: {
    layout: "fullscreen",
    a11y: { context: '[data-testid="import-queue-drawer"]' },
  },
} satisfies Meta<typeof RecipeImportQueueDrawer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A single URL import mid-extraction — the dominant single-import case. */
export const SingleExtracting: Story = {
  render: () => (
    <DrawerHarness
      concurrency={2}
      seeds={[{ id: "a", kind: "url", title: "smittenkitchen.com", park: "extracting" }]}
    />
  ),
};

/** Two active + one queued — the multi-recipe / bulk behaviour the queue exists for. */
export const QueueWithBacklog: Story = {
  render: () => (
    <DrawerHarness
      concurrency={2}
      seeds={[
        { id: "a", kind: "url", title: "Charred broccoli pasta", park: "organizing" },
        { id: "b", kind: "caption", title: "TikTok reel", park: "extracting" },
        { id: "c", kind: "url", title: "bbcgoodfood.com", queued: true },
      ]}
    />
  ),
};

/** Mixed terminal states — a done (deep-linkable), a retryable failure, plus one in flight. */
export const MixedStates: Story = {
  render: () => (
    <DrawerHarness
      concurrency={2}
      seeds={[
        { id: "a", kind: "url", title: "Miso butter salmon", done: true, recipeId: "rec-1" },
        { id: "b", kind: "url", title: "seriouseats.com", fail: "timeout" },
        { id: "c", kind: "image", title: "Recipe photo", park: "extracting" },
      ]}
    />
  ),
};

/** A non-retryable failure (bad link) — no Retry affordance, only Dismiss. */
export const NonRetryableFailure: Story = {
  render: () => (
    <DrawerHarness
      concurrency={2}
      seeds={[{ id: "a", kind: "url", title: "not-a-recipe.com", fail: "no_recipe_extracted" }]}
    />
  ),
};
