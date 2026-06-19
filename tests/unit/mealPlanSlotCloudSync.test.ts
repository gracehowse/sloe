import { describe, expect, it } from "vitest";

import {
  CLOUD_DEFAULT_SLOT_ID,
  cloudSlotIdFromLocal,
  localSlotIdFromCloud,
  mergeCloudMetadataIntoSlots,
  metadataFromSlots,
  parseMealPlanSlotsMetadata,
  SLOT_TOMBSTONE_RETENTION_MS,
  type MealPlanSlotSyncLedger,
} from "../../src/lib/mealPlan/slotCloudSync";
import {
  DEFAULT_MEAL_PLAN_SLOT_ID,
  makeDefaultSlot,
  type MealPlanNamedSlot,
} from "../../src/lib/mealPlan/namedSlots";

// Fixed clock so timestamp comparisons + tombstone pruning are deterministic.
const T0 = Date.parse("2026-06-19T12:00:00.000Z");
const iso = (offsetMs: number) => new Date(T0 + offsetMs).toISOString();

describe("cloudSlotIdFromLocal", () => {
  it("maps the canonical default local id to cloud default", () => {
    expect(cloudSlotIdFromLocal(DEFAULT_MEAL_PLAN_SLOT_ID)).toBe(CLOUD_DEFAULT_SLOT_ID);
  });

  it("passes through other local ids unchanged", () => {
    const id = "abc-123";
    expect(cloudSlotIdFromLocal(id)).toBe(id);
  });
});

describe("localSlotIdFromCloud", () => {
  it("maps cloud default back to the canonical local id", () => {
    expect(localSlotIdFromCloud(CLOUD_DEFAULT_SLOT_ID)).toBe(DEFAULT_MEAL_PLAN_SLOT_ID);
  });
});

describe("metadataFromSlots + parseMealPlanSlotsMetadata", () => {
  it("round-trips slot names and active id", () => {
    const slots: MealPlanNamedSlot[] = [
      makeDefaultSlot(),
      { id: "cut", name: "Cut", plan: null },
    ];
    const payload = metadataFromSlots(slots, "cut");
    const parsed = parseMealPlanSlotsMetadata(payload);
    expect(parsed?.active_slot_id).toBe("cut");
    expect(parsed?.slots.map((s) => s.name)).toEqual(["This week", "Cut"]);
  });

  it("returns null for malformed profile JSON", () => {
    expect(parseMealPlanSlotsMetadata(null)).toBeNull();
    expect(parseMealPlanSlotsMetadata({ slots: "nope" })).toBeNull();
    expect(parseMealPlanSlotsMetadata({ slots: [] })).toBeNull();
  });
});

describe("mergeCloudMetadataIntoSlots", () => {
  it("adds cloud-only slots with null plans and preserves local plans", () => {
    const local: MealPlanNamedSlot[] = [
      { id: DEFAULT_MEAL_PLAN_SLOT_ID, name: "This week", plan: null },
    ];
    const merged = mergeCloudMetadataIntoSlots(local, {
      slots: [
        { id: DEFAULT_MEAL_PLAN_SLOT_ID, name: "This week" },
        { id: "vacation", name: "Vacation" },
      ],
      active_slot_id: "vacation",
    });
    expect(merged.slots).toHaveLength(2);
    expect(merged.slots[1]?.name).toBe("Vacation");
    expect(merged.slots[1]?.plan).toBeNull();
    expect(merged.activeSlotId).toBe("vacation");
  });

  it("updates renamed slots from cloud metadata", () => {
    const local: MealPlanNamedSlot[] = [{ id: "a", name: "Old", plan: null }];
    const merged = mergeCloudMetadataIntoSlots(local, {
      slots: [{ id: "a", name: "Family" }],
      active_slot_id: "a",
    });
    expect(merged.slots[0]?.name).toBe("Family");
  });

  it("preserves a local-only slot the cloud registry hasn't seen yet", () => {
    // Slot created offline on this device — its metadata hasn't reached the
    // profile, so a cloud read returns a registry without it. It must NOT be
    // wiped (ENG-1130 data-loss fix), and its inline plan must survive.
    const local: MealPlanNamedSlot[] = [
      { id: DEFAULT_MEAL_PLAN_SLOT_ID, name: "This week", plan: null },
      {
        id: "offline-new",
        name: "Holiday",
        plan: [{ day: 1, meals: [], totals: { calories: 0, protein: 0, carbs: 0, fat: 0 } }],
      },
    ];
    const merged = mergeCloudMetadataIntoSlots(local, {
      slots: [{ id: DEFAULT_MEAL_PLAN_SLOT_ID, name: "This week" }],
      active_slot_id: DEFAULT_MEAL_PLAN_SLOT_ID,
    });
    expect(merged.slots.map((s) => s.id)).toContain("offline-new");
    expect(merged.slots.find((s) => s.id === "offline-new")?.plan).not.toBeNull();
  });

  // ─── ENG-1194 — last-writer-wins per slot + tombstones ───────────────────

  it("(a) keeps a slot deleted-elsewhere deleted after merge (delete propagates)", () => {
    // Device A still holds "cut" locally (a stale create timestamp). Device B
    // deleted it later, so the cloud carries a NEWER tombstone. The delete must
    // win: the slot is suppressed AND the tombstone is carried forward so A
    // re-emits it instead of resurrecting the slot.
    const local: MealPlanNamedSlot[] = [
      { id: DEFAULT_MEAL_PLAN_SLOT_ID, name: "This week", plan: null },
      { id: "cut", name: "Cut", plan: null },
    ];
    const localLedger: MealPlanSlotSyncLedger = {
      [DEFAULT_MEAL_PLAN_SLOT_ID]: { updatedAt: iso(0), deletedAt: null },
      cut: { updatedAt: iso(1000), deletedAt: null }, // created at T0+1s
    };
    const merged = mergeCloudMetadataIntoSlots(
      local,
      {
        slots: [
          { id: DEFAULT_MEAL_PLAN_SLOT_ID, name: "This week", updated_at: iso(0), deleted_at: null },
          { id: "cut", name: "Cut", updated_at: iso(5000), deleted_at: iso(5000) }, // deleted later
        ],
        active_slot_id: DEFAULT_MEAL_PLAN_SLOT_ID,
      },
      localLedger,
      T0 + 6000,
    );
    expect(merged.slots.map((s) => s.id)).not.toContain("cut");
    // Tombstone retained for re-propagation.
    expect(merged.ledger.cut?.deletedAt).toBe(iso(5000));
    // Re-serialising re-emits the tombstone so a peer learns of the delete.
    const reserialised = metadataFromSlots(merged.slots, merged.activeSlotId, merged.ledger, T0 + 6000);
    const cutEntry = reserialised.slots.find((s) => s.id === "cut");
    expect(cutEntry?.deleted_at).toBe(iso(5000));
  });

  it("(b) still preserves a never-synced local create (no cloud counterpart)", () => {
    // The original ENG-1130 fix must hold: a create that never reached the
    // cloud (no cloud entry, no tombstone) is preserved, not dropped.
    const local: MealPlanNamedSlot[] = [
      { id: DEFAULT_MEAL_PLAN_SLOT_ID, name: "This week", plan: null },
      { id: "fresh", name: "Fresh", plan: [{ day: 1, meals: [], totals: { calories: 0, protein: 0, carbs: 0, fat: 0 } }] },
    ];
    const localLedger: MealPlanSlotSyncLedger = {
      fresh: { updatedAt: iso(2000), deletedAt: null },
    };
    const merged = mergeCloudMetadataIntoSlots(
      local,
      {
        slots: [{ id: DEFAULT_MEAL_PLAN_SLOT_ID, name: "This week", updated_at: iso(0), deleted_at: null }],
        active_slot_id: DEFAULT_MEAL_PLAN_SLOT_ID,
      },
      localLedger,
      T0 + 3000,
    );
    expect(merged.slots.map((s) => s.id)).toContain("fresh");
    expect(merged.slots.find((s) => s.id === "fresh")?.plan).not.toBeNull();
    expect(merged.ledger.fresh?.deletedAt).toBeNull();
  });

  it("(c) resolves a concurrent rename by newer updatedAt (last-writer-wins)", () => {
    // Both devices renamed the same slot; the cloud write is newer, so its name
    // wins. Flip the timestamps and the local name would win instead.
    const local: MealPlanNamedSlot[] = [{ id: "a", name: "Local rename", plan: [{ day: 1, meals: [], totals: { calories: 0, protein: 0, carbs: 0, fat: 0 } }] }];
    const localLedger: MealPlanSlotSyncLedger = {
      a: { updatedAt: iso(1000), deletedAt: null },
    };
    const cloudWinsMerge = mergeCloudMetadataIntoSlots(
      local,
      { slots: [{ id: "a", name: "Cloud rename", updated_at: iso(9000), deleted_at: null }], active_slot_id: "a" },
      localLedger,
      T0 + 10000,
    );
    expect(cloudWinsMerge.slots.find((s) => s.id === "a")?.name).toBe("Cloud rename");
    // Inline plan survives even when the cloud name wins.
    expect(cloudWinsMerge.slots.find((s) => s.id === "a")?.plan).not.toBeNull();

    const localWinsMerge = mergeCloudMetadataIntoSlots(
      local,
      { slots: [{ id: "a", name: "Cloud rename", updated_at: iso(0), deleted_at: null }], active_slot_id: "a" },
      { a: { updatedAt: iso(9000), deletedAt: null } },
      T0 + 10000,
    );
    expect(localWinsMerge.slots.find((s) => s.id === "a")?.name).toBe("Local rename");
  });

  it("(d) tolerates old-shape slots with no timestamp (no crash, not wrongly deleted)", () => {
    // Pre-ENG-1194 data: cloud + local entries carry NO updated_at / deleted_at,
    // and there's no ledger at all. Merge must not crash and must keep both
    // slots live (epoch ties resolve toward cloud names, locals preserved).
    const local: MealPlanNamedSlot[] = [
      { id: "a", name: "A-local", plan: [{ day: 1, meals: [], totals: { calories: 0, protein: 0, carbs: 0, fat: 0 } }] },
      { id: "local-only", name: "Local only", plan: null },
    ];
    const merged = mergeCloudMetadataIntoSlots(local, {
      slots: [
        { id: "a", name: "A" }, // legacy shape: no updated_at, no deleted_at
        { id: "b", name: "B" },
      ],
      active_slot_id: "a",
    });
    const ids = merged.slots.map((s) => s.id);
    expect(ids).toContain("a");
    expect(ids).toContain("b");
    expect(ids).toContain("local-only"); // local-only create not wrongly deleted
    // Cloud name wins on the epoch tie; local inline plan still survives.
    expect(merged.slots.find((s) => s.id === "a")?.name).toBe("A");
    expect(merged.slots.find((s) => s.id === "a")?.plan).not.toBeNull();
    // No tombstones materialise out of legacy data.
    expect(Object.values(merged.ledger).every((e) => e.deletedAt === null)).toBe(true);
  });

  it("keeps the device's own pending tombstone when a stale cloud read lacks the slot", () => {
    // Device A deleted "cut" (gone from its live array, recorded in its ledger)
    // but the cloud read hasn't caught up and doesn't list it. The pending
    // tombstone must survive the merge so the next write-back still propagates it.
    const local: MealPlanNamedSlot[] = [
      { id: DEFAULT_MEAL_PLAN_SLOT_ID, name: "This week", plan: null },
    ];
    const localLedger: MealPlanSlotSyncLedger = {
      cut: { updatedAt: iso(4000), deletedAt: iso(4000) },
    };
    const merged = mergeCloudMetadataIntoSlots(
      local,
      {
        slots: [{ id: DEFAULT_MEAL_PLAN_SLOT_ID, name: "This week", updated_at: iso(0), deleted_at: null }],
        active_slot_id: DEFAULT_MEAL_PLAN_SLOT_ID,
      },
      localLedger,
      T0 + 5000,
    );
    expect(merged.slots.map((s) => s.id)).not.toContain("cut");
    expect(merged.ledger.cut?.deletedAt).toBe(iso(4000));
  });

  it("prunes a tombstone older than the retention window on merge", () => {
    const merged = mergeCloudMetadataIntoSlots(
      [{ id: DEFAULT_MEAL_PLAN_SLOT_ID, name: "This week", plan: null }],
      {
        slots: [
          { id: DEFAULT_MEAL_PLAN_SLOT_ID, name: "This week", updated_at: iso(0), deleted_at: null },
          { id: "ancient", name: "Plan", updated_at: iso(-SLOT_TOMBSTONE_RETENTION_MS - 1000), deleted_at: iso(-SLOT_TOMBSTONE_RETENTION_MS - 1000) },
        ],
        active_slot_id: DEFAULT_MEAL_PLAN_SLOT_ID,
      },
      {},
      T0,
    );
    expect(merged.slots.map((s) => s.id)).not.toContain("ancient");
    expect(merged.ledger.ancient).toBeUndefined(); // pruned, not retained
  });
});

describe("metadataFromSlots — tombstone serialization (ENG-1194)", () => {
  it("emits a tombstone for a ledger entry whose slot is no longer live", () => {
    const slots: MealPlanNamedSlot[] = [{ id: "keep", name: "Keep", plan: null }];
    const ledger: MealPlanSlotSyncLedger = {
      keep: { updatedAt: iso(1000), deletedAt: null },
      gone: { updatedAt: iso(2000), deletedAt: iso(2000) },
    };
    const payload = metadataFromSlots(slots, "keep", ledger, T0 + 3000);
    const gone = payload.slots.find((s) => s.id === "gone");
    expect(gone?.deleted_at).toBe(iso(2000));
    expect(payload.slots.find((s) => s.id === "keep")?.deleted_at).toBeNull();
  });

  it("prunes tombstones past the retention window at serialize time", () => {
    const ledger: MealPlanSlotSyncLedger = {
      gone: {
        updatedAt: iso(-SLOT_TOMBSTONE_RETENTION_MS - 1),
        deletedAt: iso(-SLOT_TOMBSTONE_RETENTION_MS - 1),
      },
    };
    const payload = metadataFromSlots([{ id: "keep", name: "Keep", plan: null }], "keep", ledger, T0);
    expect(payload.slots.map((s) => s.id)).not.toContain("gone");
  });

  it("stamps live slots with their ledger timestamp (epoch when unstamped)", () => {
    const slots: MealPlanNamedSlot[] = [
      { id: "stamped", name: "Stamped", plan: null },
      { id: "unstamped", name: "Unstamped", plan: null },
    ];
    const payload = metadataFromSlots(slots, "stamped", { stamped: { updatedAt: iso(500), deletedAt: null } }, T0);
    expect(payload.slots.find((s) => s.id === "stamped")?.updated_at).toBe(iso(500));
    expect(payload.slots.find((s) => s.id === "unstamped")?.updated_at).toBe(new Date(0).toISOString());
  });
});

describe("parseMealPlanSlotsMetadata — backward compatibility + tombstones", () => {
  it("parses the legacy {id,name} shape (no timestamps) without crashing", () => {
    const parsed = parseMealPlanSlotsMetadata({
      slots: [{ id: "a", name: "A" }, { id: "b", name: "B" }],
      active_slot_id: "b",
    });
    expect(parsed?.slots.map((s) => s.id)).toEqual(["a", "b"]);
    expect(parsed?.slots.every((s) => s.updated_at === undefined)).toBe(true);
    expect(parsed?.active_slot_id).toBe("b");
  });

  it("retains tombstone entries and excludes them from active resolution", () => {
    const parsed = parseMealPlanSlotsMetadata({
      slots: [
        { id: "live", name: "Live", updated_at: iso(0), deleted_at: null },
        { id: "dead", name: "Plan", updated_at: iso(1000), deleted_at: iso(1000) },
      ],
      active_slot_id: "dead", // points at a tombstone — must not be honoured
    });
    expect(parsed?.slots.map((s) => s.id)).toEqual(["live", "dead"]);
    expect(parsed?.active_slot_id).toBe("live");
  });

  it("treats an all-tombstone blob as valid (delete must still propagate)", () => {
    const parsed = parseMealPlanSlotsMetadata({
      slots: [{ id: "dead", name: "Plan", updated_at: iso(1000), deleted_at: iso(1000) }],
      active_slot_id: "dead",
    });
    expect(parsed).not.toBeNull();
    expect(parsed?.slots).toHaveLength(1);
    expect(parsed?.active_slot_id).toBeNull();
  });
});
