/**
 * Unit tests for the import-progress state machine (ENG —
 * "Import-progress staged state-machine + queue UX", 2026-06-08).
 *
 * Protects the *user-visible* contract: which stage transitions are
 * legal, which stages are terminal/active, the calm Sloe stage copy, and
 * the retry-eligibility classification. If any of these regress the
 * staged-progress UI shows an impossible or wrongly-worded state, so each
 * assertion below maps to something a user would see.
 */
import { describe, it, expect } from "vitest";
import {
  ACTIVE_STAGES,
  batchSummaryLabel,
  canTransition,
  DISPLAY_STAGES,
  importJobIdForUrl,
  isActiveStage,
  isRetryableError,
  isTerminalStage,
  queuePositionLabel,
  stageLabel,
  TERMINAL_STAGES,
  type ImportStage,
} from "@/lib/recipes/importProgressMachine";

describe("importProgressMachine — transitions", () => {
  it("walks the happy path queued → confirming → extracting → organizing → done", () => {
    expect(canTransition("queued", "confirming")).toBe(true);
    expect(canTransition("confirming", "extracting")).toBe(true);
    expect(canTransition("extracting", "organizing")).toBe(true);
    expect(canTransition("organizing", "done")).toBe(true);
  });

  it("allows cancel + fail from every non-terminal stage", () => {
    for (const from of ["queued", "confirming", "extracting", "organizing"] as ImportStage[]) {
      expect(canTransition(from, "cancelled")).toBe(true);
      expect(canTransition(from, "failed")).toBe(true);
    }
  });

  it("forbids skipping stages forward", () => {
    expect(canTransition("queued", "extracting")).toBe(false);
    expect(canTransition("queued", "organizing")).toBe(false);
    expect(canTransition("queued", "done")).toBe(false);
    expect(canTransition("confirming", "organizing")).toBe(false);
    expect(canTransition("confirming", "done")).toBe(false);
    expect(canTransition("extracting", "done")).toBe(false);
  });

  it("forbids moving backward", () => {
    expect(canTransition("extracting", "confirming")).toBe(false);
    expect(canTransition("organizing", "extracting")).toBe(false);
    expect(canTransition("done", "organizing")).toBe(false);
  });

  it("forbids any transition out of a terminal stage", () => {
    for (const from of ["done", "cancelled", "failed"] as ImportStage[]) {
      for (const to of [
        "queued",
        "confirming",
        "extracting",
        "organizing",
        "done",
        "cancelled",
        "failed",
      ] as ImportStage[]) {
        expect(canTransition(from, to)).toBe(false);
      }
    }
  });
});

describe("importProgressMachine — stage classification", () => {
  it("marks done/cancelled/failed terminal", () => {
    expect([...TERMINAL_STAGES].sort()).toEqual(["cancelled", "done", "failed"]);
    expect(isTerminalStage("done")).toBe(true);
    expect(isTerminalStage("cancelled")).toBe(true);
    expect(isTerminalStage("failed")).toBe(true);
    expect(isTerminalStage("queued")).toBe(false);
    expect(isTerminalStage("extracting")).toBe(false);
  });

  it("marks confirming/extracting/organizing active (occupying a slot)", () => {
    expect([...ACTIVE_STAGES].sort()).toEqual(["confirming", "extracting", "organizing"]);
    expect(isActiveStage("confirming")).toBe(true);
    expect(isActiveStage("extracting")).toBe(true);
    expect(isActiveStage("organizing")).toBe(true);
    // queued is NOT active — it waits for a slot.
    expect(isActiveStage("queued")).toBe(false);
    expect(isActiveStage("done")).toBe(false);
  });

  it("exposes the display rail in walk order, ending at done", () => {
    expect(DISPLAY_STAGES).toEqual(["confirming", "extracting", "organizing", "done"]);
  });
});

describe("importProgressMachine — copy (Sloe voice, no celebration)", () => {
  it("tailors the extracting label to the source modality", () => {
    expect(stageLabel("extracting", "url")).toBe("Extracting recipe details");
    expect(stageLabel("extracting", "image")).toBe("Reading the photo");
    expect(stageLabel("extracting", "caption")).toBe("Reading the post");
  });

  it("uses calm, neutral labels with no exclamation marks", () => {
    const labels = (["queued", "confirming", "extracting", "organizing", "done", "cancelled", "failed"] as ImportStage[]).map(
      (s) => stageLabel(s),
    );
    for (const l of labels) {
      expect(l).not.toMatch(/!/);
      expect(l.length).toBeGreaterThan(0);
    }
    expect(stageLabel("done")).toBe("Ready to review");
  });

  it("formats the queue-position chip 1-based", () => {
    expect(queuePositionLabel(1)).toBe("In queue (#1) — starts when a slot opens");
    expect(queuePositionLabel(3)).toBe("In queue (#3) — starts when a slot opens");
  });

  it("summarises the batch for the drawer header", () => {
    expect(batchSummaryLabel(2, 1, 0)).toBe("Importing 2 · 1 in queue");
    expect(batchSummaryLabel(1, 0, 0)).toBe("Importing 1");
    expect(batchSummaryLabel(0, 0, 0)).toBe("All imports done");
    expect(batchSummaryLabel(0, 0, 2)).toBe("Some imports need another try");
  });
});

describe("importProgressMachine — retry eligibility", () => {
  it("offers retry for transient / user-fixable-by-retry errors", () => {
    expect(isRetryableError("rate_limited")).toBe(true);
    expect(isRetryableError("ai_unavailable")).toBe(true);
    expect(isRetryableError("timeout")).toBe(true);
    expect(isRetryableError("fetch_failed")).toBe(true);
    expect(isRetryableError("network_error")).toBe(true);
    expect(isRetryableError("save_failed")).toBe(true);
  });

  it("does NOT offer retry for permanent input errors", () => {
    expect(isRetryableError("invalid_url")).toBe(false);
    expect(isRetryableError("pro_required")).toBe(false);
    expect(isRetryableError("caption_too_short")).toBe(false);
    expect(isRetryableError("duplicate_recipe")).toBe(false);
    expect(isRetryableError("unauthorized")).toBe(false);
  });

  it("treats null/undefined as not retryable", () => {
    expect(isRetryableError(null)).toBe(false);
    expect(isRetryableError(undefined)).toBe(false);
  });
});

describe("importProgressMachine — deterministic job id (dedupe)", () => {
  it("derives the same id for the same url + kind (so dup concurrent imports dedupe)", () => {
    const a = importJobIdForUrl("url", "https://smittenkitchen.com/recipe");
    const b = importJobIdForUrl("url", "https://smittenkitchen.com/recipe");
    expect(a).toBe(b);
  });

  it("normalises case + whitespace so trivially-different dups still collapse", () => {
    expect(importJobIdForUrl("url", "  https://Example.com/R  ")).toBe(
      importJobIdForUrl("url", "https://example.com/r"),
    );
  });

  it("differs by kind and by url", () => {
    expect(importJobIdForUrl("url", "x")).not.toBe(importJobIdForUrl("caption", "x"));
    expect(importJobIdForUrl("url", "a")).not.toBe(importJobIdForUrl("url", "b"));
  });
});
