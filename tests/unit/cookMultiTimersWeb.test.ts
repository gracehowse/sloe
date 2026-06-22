import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ENG-948 / ENG-1225 #10 — web↔mobile cook multi-timer parity. Web CookMode
 * used to append timers unconditionally (always concurrent) while mobile gated
 * the concurrent stack behind `cook_multi_timers_v1` (default-OFF → one timer at
 * a time). Pin that web now gates the same way, so the platforms match until the
 * flag ramps. Source-scan mirror of `apps/mobile/tests/unit/cookMultiTimers.test.tsx`.
 */
const COOK = readFileSync(
  resolve(__dirname, "../../src/app/components/CookMode.tsx"),
  "utf8",
);

describe("ENG-948 cook multi-timers parity (web)", () => {
  it("gates concurrent timers behind cook_multi_timers_v1", () => {
    expect(COOK).toContain('isFeatureEnabled("cook_multi_timers_v1")');
    expect(COOK).toMatch(/const cookMultiTimersEnabled\s*=/);
  });

  it("flag-off keeps a single timer (replace), flag-on stacks", () => {
    // The start handler branches on the flag: concurrent append vs single-slot.
    expect(COOK).toMatch(
      /cookMultiTimersEnabled\s*\?\s*\[\s*\.\.\.prev,\s*next\s*\]\s*:\s*\[\s*next\s*\]/,
    );
  });
});
