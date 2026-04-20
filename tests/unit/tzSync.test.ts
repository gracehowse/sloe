/**
 * Client-side tz writer for the weekly recap push (T12, 2026-04-20).
 * See docs/decisions/2026-04-20-weekly-recap-tz-aware-fanout.md.
 *
 * Pins:
 *   1. `resolveCurrentIanaTimezone` returns a non-empty string
 *      under the Vitest (Node) runtime.
 *   2. `syncProfileTimezone` writes `{ tz_iana: <value> }` to
 *      `profiles` scoped to the passed user id, via the
 *      `from(...).update(...).eq(...)` chain on the supabase client.
 *   3. A DB error from supabase is swallowed (returns ok:false) —
 *      the caller fires-and-forgets, never blocks auth.
 *   4. A thrown exception from the chain is also swallowed.
 */

import { describe, expect, it, vi } from "vitest";

import {
  resolveCurrentIanaTimezone,
  syncProfileTimezone,
} from "../../src/lib/profile/tzSync";

describe("resolveCurrentIanaTimezone", () => {
  it("returns a non-empty IANA-shaped string under Node/Vitest", () => {
    const tz = resolveCurrentIanaTimezone();
    // Node's Intl returns the OS timezone, which at the very least
    // is a non-empty string. Don't assert a specific value (the CI
    // box could be anywhere).
    expect(tz).toBeTypeOf("string");
    expect((tz ?? "").length).toBeGreaterThan(0);
  });
});

describe("syncProfileTimezone — happy path", () => {
  it("updates profiles.tz_iana scoped to the passed user id", async () => {
    const eq = vi.fn(async () => ({ error: null }));
    const update = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ update }));
    const client = { from };

    const result = await syncProfileTimezone(client, "user-123");
    expect(result.ok).toBe(true);
    expect(result.tz).toBeTypeOf("string");

    expect(from).toHaveBeenCalledWith("profiles");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ tz_iana: expect.any(String) }),
    );
    expect(eq).toHaveBeenCalledWith("id", "user-123");
  });
});

describe("syncProfileTimezone — failure modes (fire-and-forget)", () => {
  it("returns ok=false when supabase reports an error", async () => {
    const eq = vi.fn(async () => ({ error: { message: "column tz_iana does not exist" } }));
    const update = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ update }));
    const client = { from };

    // Silence the warn so the test output stays clean.
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await syncProfileTimezone(client, "user-123");
    expect(result.ok).toBe(false);
    expect(result.tz).toBeTypeOf("string");
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("swallows a thrown exception from the chain", async () => {
    const from = vi.fn(() => {
      throw new Error("native client not initialised");
    });
    const client = { from } as never;

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await syncProfileTimezone(client, "user-123");
    expect(result.ok).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
