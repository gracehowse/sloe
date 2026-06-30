"use client";

import { useEffect, useMemo, useState } from "react";
import { SkeletonCard, SkeletonRow } from "../ui/skeleton-row";

type ImportLoadingSkeletonProps = {
  /** URL import vs idle clipboard check — copy only. */
  phase?: "checking" | "importing";
  className?: string;
};

/**
 * Web import loading — skeleton silhouettes + status narration (ENG-606).
 * Used on RecipeUpload during URL import instead of step-only spinners.
 */
export function ImportLoadingSkeleton({
  phase = "importing",
  className,
}: ImportLoadingSkeletonProps) {
  const stages = useMemo(
    () =>
      phase === "checking"
        ? ["Looking for a recipe link…", "Reading page…", "Preparing import…"]
        : ["Fetching recipe page…", "Matching ingredients…", "Calculating nutrition…"],
    [phase],
  );
  const [stageIdx, setStageIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStageIdx((i) => (i + 1) % stages.length), 1400);
    return () => clearInterval(t);
  }, [stages.length]);

  const [slowLoad, setSlowLoad] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlowLoad(true), 8_000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      data-testid="import-loading-skeleton"
      aria-busy="true"
      aria-live="polite"
      className={className}
    >
      <SkeletonCard className="mb-4" />
      <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-3">
        <span
          className="size-4 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent"
          aria-hidden
        />
        <p className="text-sm font-semibold text-primary-solid" data-testid="import-status-narration">
          {stages[stageIdx]}
        </p>
      </div>
      <div className="space-y-2">
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow thumb={false} lines={1} />
      </div>
      {slowLoad ? (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Taking longer than usual — check the URL or try a screenshot import.
        </p>
      ) : null}
    </div>
  );
}
