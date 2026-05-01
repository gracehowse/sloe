/**
 * Weekly Check-in storage gates — pin the AsyncStorage round-trips
 * so a future change can't silently break the per-week gate or the
 * previous-TDEE snapshot.
 *
 * Authority: extended-competitor-audit task (2026-04-30, Step 7).
 */

import { describe, expect, it } from "vitest";
import {
  clearTdeeSnapshot,
  readTdeeSnapshot,
  writeTdeeSnapshot,
} from "../../lib/lastWeekTdee";
import {
  isCheckinBannerDismissed,
  markCheckinBannerDismissed,
} from "../../lib/weeklyCheckinBannerDismissal";

function makeMemoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: async (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: async (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: async (k: string) => {
      map.delete(k);
    },
    _dump: () => Object.fromEntries(map),
  };
}

describe("readTdeeSnapshot / writeTdeeSnapshot — round-trip", () => {
  it("returns null for an unwritten key", async () => {
    const storage = makeMemoryStorage();
    const out = await readTdeeSnapshot("user-1", "2026-W17", storage);
    expect(out).toBeNull();
  });

  it("writes and reads a complete snapshot", async () => {
    const storage = makeMemoryStorage();
    const now = new Date("2026-04-26T12:00:00Z");
    await writeTdeeSnapshot("user-1", "2026-W17", 2410, storage, now);
    const out = await readTdeeSnapshot("user-1", "2026-W17", storage);
    expect(out).not.toBeNull();
    expect(out!.tdee).toBe(2410);
    expect(out!.weekKey).toBe("2026-W17");
    expect(out!.capturedAt).toBe("2026-04-26T12:00:00.000Z");
  });

  it("rejects non-finite or zero values on write", async () => {
    const storage = makeMemoryStorage();
    await writeTdeeSnapshot("user-1", "2026-W17", 0, storage);
    await writeTdeeSnapshot("user-1", "2026-W17", Number.NaN, storage);
    expect(Object.keys(storage._dump())).toEqual([]);
  });

  it("returns null for a corrupt stored payload", async () => {
    const storage = makeMemoryStorage();
    await storage.setItem("weekly_checkin_tdee_v1:user-1:2026-W17", "{not json");
    const out = await readTdeeSnapshot("user-1", "2026-W17", storage);
    expect(out).toBeNull();
  });

  it("keys snapshots per (userId, weekKey)", async () => {
    const storage = makeMemoryStorage();
    await writeTdeeSnapshot("user-1", "2026-W17", 2400, storage);
    await writeTdeeSnapshot("user-2", "2026-W17", 2100, storage);
    expect((await readTdeeSnapshot("user-1", "2026-W17", storage))!.tdee).toBe(2400);
    expect((await readTdeeSnapshot("user-2", "2026-W17", storage))!.tdee).toBe(2100);
    expect(await readTdeeSnapshot("user-3", "2026-W17", storage)).toBeNull();
  });

  it("clearTdeeSnapshot removes the entry", async () => {
    const storage = makeMemoryStorage();
    await writeTdeeSnapshot("user-1", "2026-W17", 2400, storage);
    await clearTdeeSnapshot("user-1", "2026-W17", storage);
    expect(await readTdeeSnapshot("user-1", "2026-W17", storage)).toBeNull();
  });
});

describe("Sunday banner dismissal gate — per (user, weekKey)", () => {
  it("returns false before any dismissal", async () => {
    const storage = makeMemoryStorage();
    expect(await isCheckinBannerDismissed("user-1", "2026-W17", storage)).toBe(false);
  });

  it("returns true after markCheckinBannerDismissed for the same week", async () => {
    const storage = makeMemoryStorage();
    await markCheckinBannerDismissed("user-1", "2026-W17", storage);
    expect(await isCheckinBannerDismissed("user-1", "2026-W17", storage)).toBe(true);
  });

  it("dismissal does not bleed across weeks", async () => {
    const storage = makeMemoryStorage();
    await markCheckinBannerDismissed("user-1", "2026-W17", storage);
    expect(await isCheckinBannerDismissed("user-1", "2026-W18", storage)).toBe(false);
  });

  it("dismissal does not bleed across users", async () => {
    const storage = makeMemoryStorage();
    await markCheckinBannerDismissed("user-1", "2026-W17", storage);
    expect(await isCheckinBannerDismissed("user-2", "2026-W17", storage)).toBe(false);
  });

  it("ignores empty user / week key inputs", async () => {
    const storage = makeMemoryStorage();
    await markCheckinBannerDismissed("", "2026-W17", storage);
    await markCheckinBannerDismissed("user-1", "", storage);
    expect(Object.keys(storage._dump())).toEqual([]);
    expect(await isCheckinBannerDismissed("", "2026-W17", storage)).toBe(false);
    expect(await isCheckinBannerDismissed("user-1", "", storage)).toBe(false);
  });
});
