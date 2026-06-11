/**
 * Web parity pin — the Remaining/Consumed display toggle is RETIRED.
 *
 * web ring parity 2026-06-10 (mobile ring wave): the toggle that used to couple
 * `setRingDisplayMode` + `setRingExpanded` in lock-step is gone — there is one
 * centre grammar and no display-mode state on Today. This supersedes the
 * 2026-05-02 lock-step pin.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const TRACKER_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "src",
  "app",
  "components",
  "NutritionTracker.tsx",
);

describe("NutritionTracker (web) — display toggle retired", () => {
  const src = readFileSync(TRACKER_PATH, "utf8");

  it("no longer holds ring display-mode state", () => {
    expect(src).not.toContain("ringDisplayMode");
    expect(src).not.toContain("setRingDisplayMode");
  });

  it("no longer wires an onToggleDisplayMode handler", () => {
    expect(src).not.toContain("onToggleDisplayMode");
  });
});
