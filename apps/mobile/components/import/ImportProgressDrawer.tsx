import { useMemo } from "react";
import { SHEET_RADIUS } from "@/components/ui/SupprCard";
import { PressableScale } from "@/components/ui/PressableScale";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { Check, CheckCheck, RefreshCw, X } from "lucide-react-native";

import { Accent, Radius, Spacing } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { IMPORT_ERROR_COPY } from "@suppr/shared/recipes/importErrorCopy";
import {
  DISPLAY_STAGES,
  queuePositionLabel,
  stageLabel,
  type ImportJobView,
  type ImportStage,
} from "@suppr/shared/recipes/importProgressMachine";
import type { UseImportQueueResult } from "@suppr/shared/recipes/useImportQueue";

/**
 * Mobile persistent import-queue drawer (ENG — "Import-progress staged
 * state-machine + queue UX", 2026-06-08).
 *
 * The mobile half of the Julienne staged-progress borrow: a calm,
 * non-blocking panel anchored above the import screen's footer that lists
 * every in-flight + recent recipe import with live per-stage progress,
 * queue position, and per-recipe cancel/retry. The queue logic + stage copy
 * are shared verbatim with web (`@suppr/shared/recipes/useImportQueue`);
 * only this presentation is RN-native.
 *
 * Renders `null` when there is no activity AND no recent history, so it's
 * safe to always mount when the `import-progress-v2` flag is on.
 */
type Props = {
  queue: UseImportQueueResult;
  /** Navigate to a finished recipe (deep-link). */
  onOpenRecipe?: (recipeId: string) => void;
};

function railIndex(stage: ImportStage): number {
  return (DISPLAY_STAGES as readonly ImportStage[]).indexOf(stage);
}

export function ImportProgressDrawer({ queue, onOpenRecipe }: Props) {
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the in-flight spinner.
  const accent = useAccent();
  const { inFlight, recent, summary, hasActivity, activeCount, queuedCount } = queue;

  if (!hasActivity && recent.length === 0) return null;

  return (
    <View
      accessibilityLabel="Recipe imports"
      accessibilityLiveRegion="polite"
      testID="import-progress-drawer"
      style={{
        borderTopWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        borderTopLeftRadius: SHEET_RADIUS,
        borderTopRightRadius: SHEET_RADIUS,
        paddingTop: Spacing.md,
        paddingBottom: Spacing.sm,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: Spacing.lg,
          marginBottom: Spacing.sm,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
          {hasActivity ? (
            <ActivityIndicator size="small" color={accent.primary} />
          ) : (
            <CheckCheck size={18} color={colors.textSecondary} />
          )}
          <View style={{ flex: 1 }}>
            <Text
              testID="import-progress-summary"
              style={{ fontSize: 14, fontWeight: "700", color: colors.text }}
            >
              {summary}
            </Text>
            {hasActivity ? (
              <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                {activeCount} importing
                {queuedCount > 0 ? ` · ${queuedCount} waiting` : ""}
              </Text>
            ) : null}
          </View>
        </View>
        {recent.length > 0 && !hasActivity ? (
          <PressableScale
            onPress={queue.clearFinished}
            haptic="destructive"
            accessibilityRole="button"
            accessibilityLabel="Clear finished imports"
            hitSlop={8}
            style={{ paddingVertical: 4, paddingHorizontal: 8 }}
          >
            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.textSecondary }}>
              Clear
            </Text>
          </PressableScale>
        ) : null}
      </View>

      <ScrollView
        style={{ maxHeight: 240 }}
        contentContainerStyle={{ paddingHorizontal: Spacing.lg, gap: Spacing.sm }}
        showsVerticalScrollIndicator={false}
      >
        {inFlight.map((job) => (
          <ImportJobRow key={job.id} job={job} queue={queue} />
        ))}
        {recent.map((job) => (
          <ImportJobRow key={job.id} job={job} queue={queue} onOpenRecipe={onOpenRecipe} />
        ))}
      </ScrollView>
    </View>
  );
}

function ImportJobRow({
  job,
  queue,
  onOpenRecipe,
}: {
  job: ImportJobView;
  queue: UseImportQueueResult;
  onOpenRecipe?: (recipeId: string) => void;
}) {
  const colors = useThemeColors();
  const isFailed = job.stage === "failed";
  const isDone = job.stage === "done";
  const isCancelled = job.stage === "cancelled";
  const isQueued = job.stage === "queued";

  const failureMessage = useMemo(
    () => (isFailed && job.errorCode ? IMPORT_ERROR_COPY[job.errorCode] : null),
    [isFailed, job.errorCode],
  );

  const statusColor = isFailed
    ? Accent.destructive
    : isDone
      ? Accent.success
      : colors.textSecondary;

  const statusText = isQueued && job.queuePosition != null
    ? queuePositionLabel(job.queuePosition)
    : isFailed
      ? (failureMessage ?? stageLabel(job.stage, job.kind))
      : stageLabel(job.stage, job.kind);

  const clickable = isDone && job.recipeId != null && onOpenRecipe != null;

  return (
    <PressableScale
      testID="import-progress-row"
      haptic="selection"
      accessibilityRole={clickable ? "button" : undefined}
      accessibilityLabel={`${job.title}, ${statusText}`}
      onPress={clickable ? () => onOpenRecipe!(job.recipeId!) : undefined}
      disabled={!clickable}
      style={{
        borderWidth: 1,
        borderColor: isFailed ? `${Accent.destructive}55` : colors.border,
        backgroundColor: isFailed
          ? `${Accent.destructive}10`
          : isCancelled
            ? colors.backgroundSecondary
            : colors.background,
        borderRadius: Radius.md,
        paddingHorizontal: 12,
        paddingVertical: 10,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>
            {job.title}
          </Text>
          <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 11, color: statusColor }}>
            {statusText}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          {isDone ? (
            <View
              accessibilityRole="image"
              accessibilityLabel="Imported"
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: Accent.success,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Check size={13} color={colors.primaryForeground} strokeWidth={3} />
            </View>
          ) : null}
          {job.canRetry ? (
            <PressableScale
              onPress={() => queue.retry(job.id)}
              haptic="selection"
              accessibilityRole="button"
              accessibilityLabel={`Retry importing ${job.title}`}
              testID="import-progress-retry"
              hitSlop={8}
              style={{ width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" }}
            >
              <RefreshCw size={15} color={colors.textSecondary} />
            </PressableScale>
          ) : null}
          {!isDone && !isCancelled ? (
            <PressableScale
              onPress={() => queue.cancel(job.id)}
              haptic="selection"
              accessibilityRole="button"
              accessibilityLabel={`Cancel importing ${job.title}`}
              testID="import-progress-cancel"
              hitSlop={8}
              style={{ width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" }}
            >
              <X size={17} color={colors.textSecondary} />
            </PressableScale>
          ) : null}
          {isFailed || isCancelled ? (
            <PressableScale
              onPress={() => queue.dismiss(job.id)}
              haptic="selection"
              accessibilityRole="button"
              accessibilityLabel={`Dismiss ${job.title}`}
              testID="import-progress-dismiss"
              hitSlop={8}
              style={{ width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" }}
            >
              <X size={17} color={colors.textSecondary} />
            </PressableScale>
          ) : null}
        </View>
      </View>

      {!isQueued && !isDone && !isFailed && !isCancelled ? (
        <StageRail stage={job.stage} />
      ) : null}
    </PressableScale>
  );
}

/** Compact 2-segment rail: confirming → extracting → organizing. */
function StageRail({ stage }: { stage: ImportStage }) {
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the active/reached
  // rail segments.
  const accent = useAccent();
  const current = railIndex(stage);
  const segments = DISPLAY_STAGES.filter((s) => s !== "done");
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 }} accessibilityElementsHidden>
      {segments.map((s) => {
        const idx = railIndex(s);
        const reached = idx <= current;
        const active = idx === current;
        return (
          <View
            key={s}
            style={{
              height: 4,
              flex: 1,
              borderRadius: 2,
              backgroundColor: active
                ? accent.primary
                : reached
                  ? accent.primaryLight
                  : colors.border,
            }}
          />
        );
      })}
    </View>
  );
}
