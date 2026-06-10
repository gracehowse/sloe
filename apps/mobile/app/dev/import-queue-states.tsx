/**
 * Mobile-side mirror of `app/dev/import-queue/page.tsx` (web).
 *
 * Renders the REAL `ImportProgressDrawer` against isolated, seeded
 * `RecipeImportScheduler` instances so Maestro (or a manual iOS Simulator
 * screenshot) can validate the staged-progress + queue UX
 * (`import-progress-v2`) and its web parity — queued, mid-stage, done,
 * retryable failure, non-retryable failure — without auth or live imports.
 *
 * 404-equivalent in production by simply not being routed; Expo Router
 * includes the file but no nav exposes it. Reachable only via deeplink
 * `suppr:///dev/import-queue-states`.
 */
import * as React from "react";
import { ScrollView, View, Text } from "react-native";
import { Stack } from "expo-router";

import { ImportProgressDrawer } from "@/components/import/ImportProgressDrawer";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useImportQueue } from "@suppr/shared/recipes/useImportQueue";
import {
  RecipeImportScheduler,
  ImportRunnerError,
  type ImportRunnerControls,
  type ImportStage,
} from "@suppr/shared/recipes/recipeImportScheduler";

type Seed =
  | { id: string; kind: "url" | "image" | "caption"; title: string; park: Exclude<ImportStage, "queued" | "done" | "cancelled" | "failed"> }
  | { id: string; kind: "url" | "image" | "caption"; title: string; done: true; recipeId?: string }
  | { id: string; kind: "url" | "image" | "caption"; title: string; fail: ImportRunnerError["code"] }
  | { id: string; kind: "url" | "image" | "caption"; title: string; queued: true };

function parkedRunner(target: Exclude<ImportStage, "queued" | "done" | "cancelled" | "failed">) {
  return (controls: ImportRunnerControls): Promise<{ title?: string }> => {
    if (target === "extracting" || target === "organizing") controls.setStage("extracting");
    if (target === "organizing") controls.setStage("organizing");
    return new Promise(() => {});
  };
}

function Frame({ label, note, seeds, concurrency }: { label: string; note: string; seeds: Seed[]; concurrency: number }) {
  const colors = useThemeColors();
  const scheduler = React.useMemo(() => new RecipeImportScheduler({ concurrency }), [concurrency]);
  const queue = useImportQueue("mobile", undefined, scheduler);
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
    <View
      testID={`frame-${label}`}
      style={{
        marginBottom: 24,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.backgroundSecondary,
        overflow: "hidden",
      }}
    >
      <View style={{ padding: 14, paddingBottom: 8 }}>
        <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1, color: colors.textSecondary, marginBottom: 4 }}>
          {label.toUpperCase()}
        </Text>
        <Text style={{ fontSize: 12, color: colors.textSecondary }}>{note}</Text>
      </View>
      <ImportProgressDrawer queue={queue} onOpenRecipe={() => {}} />
    </View>
  );
}

export default function ImportQueueStatesScreen() {
  const colors = useThemeColors();
  return (
    <>
      <Stack.Screen options={{ title: "Import queue states" }} />
      <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ padding: 20 }}>
          <Text style={{ fontSize: 22, fontWeight: "700", color: colors.text, marginBottom: 4 }}>
            Import-progress + queue (mobile)
          </Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 20 }}>
            The persistent import-queue drawer (import-progress-v2). Each frame seeds an isolated scheduler.
          </Text>

          <Frame
            label="Single — extracting"
            note="One URL import, the long server leg. Spinner + stage rail."
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
        </View>
      </ScrollView>
    </>
  );
}
