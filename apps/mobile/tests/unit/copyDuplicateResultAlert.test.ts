/**
 * ENG-1522 — honest copy/duplicate result messaging.
 *
 * `copyDuplicateBatchAlert` turns per-day succeeded/failed counts from a
 * date-range copy or duplicate into one consolidated, honest alert instead
 * of the pre-fix unconditional "Copied"/"Duplicated" success message fired
 * before the write even started.
 */
import { describe, it, expect } from "vitest";
import { copyDuplicateBatchAlert } from "../../lib/copyDuplicateResultAlert";

describe("copyDuplicateBatchAlert", () => {
  it("all days succeeded — plain success alert with the sheet's own summary", () => {
    const result = copyDuplicateBatchAlert("Copied", 3, 3, 0, "Copied to 3 days");
    expect(result).toEqual({ title: "Copied", message: "Copied to 3 days" });
  });

  it("all days failed — 'Saved on this device' framing, no false success claim", () => {
    const result = copyDuplicateBatchAlert("Copied", 3, 0, 3, "Copied to 3 days");
    expect(result.title).toBe("Saved on this device");
    expect(result.message).toBe("We'll sync this log when you're back online.");
    // Never claims the summary succeeded when nothing persisted.
    expect(result.message).not.toContain("Copied to 3 days");
  });

  it("partial failure — states how many synced and that the rest are pending, not silent", () => {
    const result = copyDuplicateBatchAlert("Copied", 5, 3, 2, "Copied to 5 days");
    expect(result.title).toBe("Copied to some days");
    expect(result.message).toBe(
      "Synced to 3 of 5 days — the rest are saved on this device and will sync when you're back online.",
    );
  });

  it("duplicate verb uses the same shape as copy", () => {
    const allOk = copyDuplicateBatchAlert("Duplicated", 2, 2, 0, "Duplicated to 2 days");
    expect(allOk).toEqual({ title: "Duplicated", message: "Duplicated to 2 days" });

    const partial = copyDuplicateBatchAlert("Duplicated", 4, 1, 3, "Duplicated to 4 days");
    expect(partial.title).toBe("Duplicated to some days");
    expect(partial.message).toContain("Synced to 1 of 4 days");
  });
});
