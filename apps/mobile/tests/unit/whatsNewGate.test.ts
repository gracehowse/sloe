/**
 * `shouldAutoShowWhatsNew` gate — unit coverage.
 *
 * The gate decides whether the root `_layout.tsx` effect pushes
 * `/whats-new` on launch. Getting any of these cases wrong affects
 * every mobile user, so the contract is pinned here explicitly:
 *
 *   - No stored build → true (first launch, or first launch after
 *     a clean install).
 *   - Stored === current → false (already seen this build).
 *   - Stored < current → true (build-number bump).
 *   - Storage `getItem` throws → false (fail closed; don't block
 *     launch).
 *   - Invalid current build number (NaN, <=0, non-integer) → false.
 *   - `markWhatsNewSeen` writes the current build as a decimal
 *     string under the canonical key.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  markWhatsNewSeen,
  resolveCurrentBuildNumber,
  shouldAutoShowWhatsNew,
  WHATS_NEW_STORAGE_KEY,
} from "../../lib/whatsNew";

function makeStorage(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    store,
    async getItem(key: string): Promise<string | null> {
      return store.has(key) ? store.get(key)! : null;
    },
    async setItem(key: string, value: string): Promise<void> {
      store.set(key, value);
    },
  };
}

function makeThrowingStorage(when: "get" | "set" | "both") {
  return {
    async getItem(_key: string): Promise<string | null> {
      if (when === "get" || when === "both") {
        throw new Error("boom");
      }
      return null;
    },
    async setItem(_key: string, _value: string): Promise<void> {
      if (when === "set" || when === "both") {
        throw new Error("boom");
      }
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("shouldAutoShowWhatsNew", () => {
  it("returns true on first ever launch (no stored build)", async () => {
    const storage = makeStorage();
    expect(await shouldAutoShowWhatsNew(10, storage)).toBe(true);
  });

  it("returns false when the current build equals the last-seen build", async () => {
    const storage = makeStorage({ [WHATS_NEW_STORAGE_KEY]: "10" });
    expect(await shouldAutoShowWhatsNew(10, storage)).toBe(false);
  });

  it("returns true when the current build is greater than the last-seen build", async () => {
    const storage = makeStorage({ [WHATS_NEW_STORAGE_KEY]: "10" });
    expect(await shouldAutoShowWhatsNew(11, storage)).toBe(true);
  });

  it("returns false on a downgrade (current < stored) — never re-show on a rollback", async () => {
    const storage = makeStorage({ [WHATS_NEW_STORAGE_KEY]: "12" });
    expect(await shouldAutoShowWhatsNew(10, storage)).toBe(false);
  });

  it("returns false when storage.getItem throws — a failed read must not block launch", async () => {
    const storage = makeThrowingStorage("get");
    expect(await shouldAutoShowWhatsNew(10, storage)).toBe(false);
  });

  it("returns false for a non-finite / non-integer / non-positive current build", async () => {
    const storage = makeStorage();
    // Guard against bad callers — the helper never trusts the input.
    expect(await shouldAutoShowWhatsNew(Number.NaN, storage)).toBe(false);
    expect(await shouldAutoShowWhatsNew(0, storage)).toBe(false);
    expect(await shouldAutoShowWhatsNew(-1, storage)).toBe(false);
    expect(await shouldAutoShowWhatsNew(10.5, storage)).toBe(false);
  });

  it("treats a corrupt stored value (non-numeric, empty, negative) as 'never seen' → true", async () => {
    for (const bad of ["abc", "", "-5", "  "]) {
      const storage = makeStorage({ [WHATS_NEW_STORAGE_KEY]: bad });
      expect(await shouldAutoShowWhatsNew(10, storage)).toBe(true);
    }
  });
});

describe("markWhatsNewSeen", () => {
  it("writes the current build under the canonical key as a decimal string", async () => {
    const storage = makeStorage();
    await markWhatsNewSeen(10, storage);
    expect(storage.store.get(WHATS_NEW_STORAGE_KEY)).toBe("10");
  });

  it("swallows storage.setItem errors — a failed write never throws", async () => {
    const storage = makeThrowingStorage("set");
    // Must resolve, not reject.
    await expect(markWhatsNewSeen(10, storage)).resolves.toBeUndefined();
  });

  it("no-ops for a non-finite / non-positive build number (never corrupts storage)", async () => {
    const storage = makeStorage();
    await markWhatsNewSeen(Number.NaN, storage);
    await markWhatsNewSeen(0, storage);
    await markWhatsNewSeen(-1, storage);
    await markWhatsNewSeen(10.5, storage);
    expect(storage.store.size).toBe(0);
  });

  it("round-trips with shouldAutoShowWhatsNew — after marking, the gate returns false", async () => {
    const storage = makeStorage();
    expect(await shouldAutoShowWhatsNew(10, storage)).toBe(true);
    await markWhatsNewSeen(10, storage);
    expect(await shouldAutoShowWhatsNew(10, storage)).toBe(false);
    // And a later build bump flips it back to true.
    expect(await shouldAutoShowWhatsNew(11, storage)).toBe(true);
  });
});

describe("resolveCurrentBuildNumber", () => {
  it("reads ios.buildNumber as a numeric string (the EAS default)", () => {
    expect(
      resolveCurrentBuildNumber({ ios: { buildNumber: "10" } }),
    ).toBe(10);
  });

  it("reads ios.buildNumber as a number if EAS ever emits it that way", () => {
    expect(resolveCurrentBuildNumber({ ios: { buildNumber: 10 } })).toBe(10);
  });

  it("falls back to android.versionCode when ios is absent", () => {
    expect(
      resolveCurrentBuildNumber({ android: { versionCode: 10 } }),
    ).toBe(10);
  });

  it("returns null for unreadable shapes — caller falls back to 'don't auto-show'", () => {
    expect(resolveCurrentBuildNumber(null)).toBe(null);
    expect(resolveCurrentBuildNumber(undefined)).toBe(null);
    expect(resolveCurrentBuildNumber({})).toBe(null);
    expect(resolveCurrentBuildNumber({ ios: {} })).toBe(null);
    expect(
      resolveCurrentBuildNumber({ ios: { buildNumber: "" } }),
    ).toBe(null);
    expect(
      resolveCurrentBuildNumber({ ios: { buildNumber: "abc" } }),
    ).toBe(null);
    expect(
      resolveCurrentBuildNumber({ ios: { buildNumber: -1 } }),
    ).toBe(null);
    expect(
      resolveCurrentBuildNumber({ ios: { buildNumber: 0 } }),
    ).toBe(null);
  });
});
