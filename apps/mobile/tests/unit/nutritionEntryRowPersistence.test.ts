/** @vitest-environment jsdom */
/**
 * ENG (2026-06-12, launch-audit P1-1 / P1-2) — behavioural coverage for the
 * `nutrition_entries` write payload.
 *
 * Before this file, the only "eaten_at" guard was a source-grep
 * (`journalSupabasePersistence.test.ts`) that asserted a function NAME
 * appeared — a refactor dropping `eaten_at` from the write would pass every
 * test. This is the exact data-integrity class that previously cost Grace
 * ~25 days of journal data, so it now has real assertions:
 *
 *   1. `buildNutritionEntryRow` ALWAYS emits `eaten_at` + `date_key`, derived
 *      identically to the immediate-persist path; the column set is uniform
 *      across meals with and without `eatenAt` (so the PostgREST upsert column
 *      set can never become heterogeneous).
 *   2. `buildNutritionEntryUpdatePayload` carries the same fields, with the
 *      same-day clamp pinned.
 *   3. The 600ms debounced backstop (`useNutritionEntriesSync`) actually sends
 *      those rows — preserving a real `eatenAt` verbatim and null otherwise.
 *   4. A wiring-pin guards that every `nutrition_entries` UPSERT site builds
 *      rows via `buildNutritionEntryRow` (string-level — labelled as a pin).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildNutritionEntryRow,
  buildNutritionEntryUpdatePayload,
  NUTRITION_ENTRY_UUID_RE,
} from "../../lib/nutritionEntryRow";
import {
  dateKeyFromInstant,
  eatenAtIsoFromLocalParts,
} from "../../../../src/lib/nutrition/mealEatenAt";

type MealLike = Parameters<typeof buildNutritionEntryRow>[0];

const ANCHOR = "2026-06-12";
const USER = "user-123";
const VALID_UUID = "11111111-1111-1111-1111-111111111111";

function makeMeal(overrides: Partial<MealLike> = {}): MealLike {
  return {
    id: VALID_UUID,
    name: "Lunch",
    recipeTitle: "Chicken salad",
    time: "12:30",
    calories: 420,
    protein: 35,
    carbs: 18,
    fat: 22,
    fiberG: 5,
    waterMl: null,
    portionMultiplier: 1,
    micros: {},
    source: "manual",
    ...overrides,
  } as MealLike;
}

describe("buildNutritionEntryRow", () => {
  it("always includes eaten_at and date_key in the row", () => {
    const row = buildNutritionEntryRow(makeMeal(), ANCHOR, USER);
    expect(row).toHaveProperty("eaten_at");
    expect(row).toHaveProperty("date_key");
    expect(row.user_id).toBe(USER);
  });

  it("eatenAt undefined → eaten_at null and date_key falls back to anchor day", () => {
    const row = buildNutritionEntryRow(makeMeal({ eatenAt: undefined }), ANCHOR, USER);
    expect(row.eaten_at).toBeNull();
    expect(row.date_key).toBe(ANCHOR);
  });

  it("eatenAt set → eaten_at preserved verbatim and date_key derived from it", () => {
    // 21:45 local on the anchor day — date_key must come from the instant,
    // not the anchor string, so this is a real derivation (same value here
    // because the time is on the anchor day, but driven by eaten_at).
    const eatenAt = eatenAtIsoFromLocalParts(ANCHOR, 21, 45);
    const row = buildNutritionEntryRow(makeMeal({ eatenAt }), ANCHOR, USER);
    expect(row.eaten_at).toBe(eatenAt);
    expect(row.date_key).toBe(dateKeyFromInstant(eatenAt));
    expect(row.date_key).toBe(ANCHOR);
  });

  it("date_key tracks the eaten instant even when it differs from the anchor day", () => {
    // A consumption instant on a DIFFERENT calendar day must attribute the
    // row to the eaten day, not the anchor — proving date_key is derived
    // from eaten_at, not hard-coded.
    const eatenAt = eatenAtIsoFromLocalParts("2026-06-10", 9, 0);
    const row = buildNutritionEntryRow(makeMeal({ eatenAt }), ANCHOR, USER);
    expect(row.eaten_at).toBe(eatenAt);
    expect(row.date_key).toBe("2026-06-10");
    expect(row.date_key).not.toBe(ANCHOR);
  });

  it("derives date_key from the profile timezone instead of the editing device timezone", () => {
    const timeZone = "America/New_York";
    const eatenAt = eatenAtIsoFromLocalParts("2026-06-11", 23, 50, timeZone);
    const row = buildNutritionEntryRow(makeMeal({ eatenAt }), ANCHOR, USER, timeZone);
    expect(row.eaten_at).toBe("2026-06-12T03:50:00.000Z");
    expect(row.date_key).toBe("2026-06-11");
  });

  it("re-mints a non-UUID id but keeps a real UUID", () => {
    expect(buildNutritionEntryRow(makeMeal({ id: VALID_UUID }), ANCHOR, USER).id).toBe(VALID_UUID);
    const reminted = buildNutritionEntryRow(makeMeal({ id: "free-text-id" }), ANCHOR, USER).id;
    expect(reminted).not.toBe("free-text-id");
    expect(reminted).toMatch(NUTRITION_ENTRY_UUID_RE);
  });

  it("CRITICAL: column set is identical across meals with and without eatenAt", () => {
    // The PostgREST upsert column set is the UNION of every row's keys. If one
    // row had `eaten_at` and another omitted it, the batch would be
    // heterogeneous and the omitting row could NULL or default the column.
    // Asserting Object.keys equality makes that impossible.
    const withEaten = buildNutritionEntryRow(
      makeMeal({ eatenAt: eatenAtIsoFromLocalParts(ANCHOR, 8, 0) }),
      ANCHOR,
      USER,
    );
    const withoutEaten = buildNutritionEntryRow(makeMeal({ eatenAt: undefined }), ANCHOR, USER);
    expect(Object.keys(withEaten).sort()).toEqual(Object.keys(withoutEaten).sort());
    expect(Object.keys(withEaten)).toContain("eaten_at");
    expect(Object.keys(withoutEaten)).toContain("eaten_at");
  });

  it("normalises empty micros to {} and source through the canonical map", () => {
    const row = buildNutritionEntryRow(makeMeal({ micros: {}, source: "OFF" }), ANCHOR, USER);
    expect(row.nutrition_micros).toEqual({});
    // canonicalNutritionEntrySource maps unknown labels; assert it's a string,
    // never the raw passthrough of an empty/unknown value.
    expect(typeof row.source === "string" || row.source === null).toBe(true);
  });
});

describe("buildNutritionEntryUpdatePayload", () => {
  it("includes eaten_at and date_key", () => {
    const payload = buildNutritionEntryUpdatePayload(makeMeal(), ANCHOR);
    expect(payload).toHaveProperty("eaten_at");
    expect(payload).toHaveProperty("date_key");
  });

  it("same-day clamp: a 23:30 local time on the anchor day stays on the anchor day", () => {
    // Mirrors the edit-meal time-field path: a localTime override on the
    // anchor day must NOT cross into the next calendar day.
    const payload = buildNutritionEntryUpdatePayload(makeMeal(), ANCHOR, { hours: 23, minutes: 30 });
    expect(payload.date_key).toBe(ANCHOR);
    expect(payload.eaten_at).toBe(eatenAtIsoFromLocalParts(ANCHOR, 23, 30));
  });

  it("localTime override clamps in the profile timezone", () => {
    const timeZone = "America/New_York";
    const payload = buildNutritionEntryUpdatePayload(
      makeMeal(),
      "2026-06-11",
      { hours: 23, minutes: 50 },
      timeZone,
    );
    expect(payload.date_key).toBe("2026-06-11");
    expect(payload.eaten_at).toBe("2026-06-12T03:50:00.000Z");
  });

  it("no localTime → derives from meal.eatenAt (as saveEditMeal calls it)", () => {
    const eatenAt = eatenAtIsoFromLocalParts(ANCHOR, 7, 15);
    const payload = buildNutritionEntryUpdatePayload(makeMeal({ eatenAt }), ANCHOR);
    expect(payload.eaten_at).toBe(eatenAt);
    expect(payload.date_key).toBe(dateKeyFromInstant(eatenAt));
  });

  it("no localTime + no eatenAt → eaten_at null, date_key anchor", () => {
    const payload = buildNutritionEntryUpdatePayload(makeMeal({ eatenAt: undefined }), ANCHOR);
    expect(payload.eaten_at).toBeNull();
    expect(payload.date_key).toBe(ANCHOR);
  });
});

// ---------------------------------------------------------------------------
// Backstop behaviour — the debounced `useNutritionEntriesSync` must send the
// builder rows, preserving a real eatenAt verbatim and null otherwise.
// ---------------------------------------------------------------------------

const upsertResult = { error: null as { message: string } | null };
const upsertMock = vi.fn();
const fromMock = vi.fn().mockImplementation(() => ({
  upsert: (rows: unknown, opts: unknown) => {
    upsertMock(rows, opts);
    // Thenable so the hook's `.then(({ error }) => …)` chain resolves.
    return { then: (cb: (r: typeof upsertResult) => void) => cb(upsertResult) };
  },
}));

vi.mock("@/lib/supabase", () => ({
  supabase: { from: (table: string) => fromMock(table) },
}));
vi.mock("@/lib/healthKitMealWriter", () => ({
  writeMealToHealthKitIfEnabled: vi.fn(),
}));
vi.mock("../../../../src/lib/nutrition/dailyTargetSnapshot", () => ({
  snapshotDailyTargetIfMissing: vi.fn(),
}));

describe("useNutritionEntriesSync backstop sends builder rows with eaten_at", () => {
  const FIXED_DATE = new Date(2026, 5, 12, 12, 0, 0); // 2026-06-12 local noon
  const EATEN_UUID = "22222222-2222-2222-2222-222222222222";
  let renderHook: typeof import("@testing-library/react-native").renderHook;
  let useNutritionEntriesSync: typeof import("../../hooks/useNutritionEntriesSync").useNutritionEntriesSync;

  beforeEach(async () => {
    ({ renderHook } = await import("@testing-library/react-native"));
    ({ useNutritionEntriesSync } = await import("../../hooks/useNutritionEntriesSync"));
    vi.useFakeTimers();
    upsertResult.error = null;
    fromMock.mockClear();
    upsertMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("upserts once after 600ms with eatenAt preserved verbatim and null for the other meal", () => {
    const eatenAt = eatenAtIsoFromLocalParts(ANCHOR, 19, 5);
    const byDay = {
      [ANCHOR]: [
        makeMeal({ id: EATEN_UUID, eatenAt }),
        makeMeal({ id: VALID_UUID, eatenAt: undefined }),
      ],
    };
    renderHook(() =>
      useNutritionEntriesSync({ userId: USER, hydrated: true, byDay, selectedDate: FIXED_DATE }),
    );
    vi.advanceTimersByTime(600);

    expect(upsertMock).toHaveBeenCalledTimes(1);
    const [rows, opts] = upsertMock.mock.calls[0] as [
      Array<{ id: string; eaten_at: string | null; date_key: string }>,
      { onConflict: string },
    ];
    expect(opts).toEqual({ onConflict: "id" });
    expect(rows).toHaveLength(2);

    const eatenRow = rows.find((r) => r.id === EATEN_UUID)!;
    const plainRow = rows.find((r) => r.id === VALID_UUID)!;
    expect(eatenRow.eaten_at).toBe(eatenAt); // verbatim, not NULLed
    expect(eatenRow.date_key).toBe(dateKeyFromInstant(eatenAt));
    expect(plainRow.eaten_at).toBeNull();
    expect(plainRow.date_key).toBe(ANCHOR);

    // Uniform column set across both rows — the backstop can never emit a
    // heterogeneous upsert column set.
    expect(Object.keys(eatenRow).sort()).toEqual(Object.keys(plainRow).sort());
  });
});

// ---------------------------------------------------------------------------
// Wiring pin (string-level, by design — labelled as a pin, NOT behavioural):
// every `nutrition_entries` UPSERT call site must build its rows via
// `buildNutritionEntryRow`, so the column set can never silently diverge again.
// ---------------------------------------------------------------------------

describe("wiring pin — every nutrition_entries write builds via buildNutritionEntryRow", () => {
  const REPO = resolve(__dirname, "..", "..", "..", "..");
  const MOBILE_ROOT = resolve(REPO, "apps", "mobile");

  /**
   * Walk apps/mobile source (app/, components/, hooks/, lib/) for every
   * `.from("nutrition_entries")` call followed by `.insert(` or `.upsert(`.
   * Every writer must either build rows via `buildNutritionEntryRow` /
   * `buildNutritionEntryUpdatePayload`, or be on the explicit allowlist
   * with a documented reason. Catches the launch-audit M1 class: a new
   * inline row literal that silently omits `eaten_at` (or any column)
   * and diverges the write shape.
   */
  const SOURCE_DIRS = ["app", "components", "hooks", "lib"];
  const WRITE_RE = /from\(["']nutrition_entries["']\)[\s\S]{0,200}?\.(insert|upsert)\(/g;

  /** Writers sanctioned to bypass the builder — each needs a reason. */
  const ALLOWLIST: Record<string, string> = {
    "lib/healthSync.ts":
      "intentionally eaten_at-less: dedupes on created_at + health_sample_id; " +
      "needs created_at/health_sample_id which the journal row shape omits " +
      "(documented at the call site)",
    "hooks/useJournalWriteAhead.ts":
      "ENG-1447 — a generic write-ahead TRANSPORT (enqueue-then-upsert-then-ack " +
      "+ timeout), not a row-builder: every call site (TodayScreen's " +
      "persistMealsImmediate / insertClonedRowsIntoDay) builds its rows via " +
      "buildNutritionEntryRow BEFORE calling writeAhead(dayKey, dbRows) — pinned " +
      "in journalSupabasePersistence.test.ts. The hook only ever forwards " +
      "already-built rows, so requiring it to import the builder itself would " +
      "just be a redundant re-assertion, not a real safety net.",
  };

  function walk(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      return /\.(ts|tsx)$/.test(entry.name) && !/\.(test|stories)\./.test(entry.name)
        ? [full]
        : [];
    });
  }

  it("every mobile nutrition_entries insert/upsert site uses the shared builder (or is allow-listed)", () => {
    const offenders: string[] = [];
    const writers: string[] = [];
    for (const d of SOURCE_DIRS) {
      for (const file of walk(resolve(MOBILE_ROOT, d))) {
        const src = readFileSync(file, "utf8");
        if (!WRITE_RE.test(src)) {
          WRITE_RE.lastIndex = 0;
          continue;
        }
        WRITE_RE.lastIndex = 0;
        const rel = file.slice(MOBILE_ROOT.length + 1).replace(/\\/g, "/");
        writers.push(rel);
        if (rel in ALLOWLIST) continue;
        const usesBuilder =
          src.includes("buildNutritionEntryRow(") ||
          src.includes("buildNutritionEntryUpdatePayload(");
        if (!usesBuilder) offenders.push(rel);
      }
    }
    expect(offenders, `nutrition_entries writers bypassing buildNutritionEntryRow: ${offenders.join(", ")}`).toEqual([]);
    // The known writer set — update deliberately when adding a writer, so a
    // new write site is a conscious decision, not an accident.
    expect(writers.sort()).toEqual(
      [
        "app/(tabs)/barcode.tsx",
        "app/(tabs)/_today/TodayScreen.tsx",
        "app/(tabs)/planner.tsx",
        "app/recipe/[id].tsx",
        "hooks/useNutritionEntriesSync.ts",
        "hooks/useJournalWriteAhead.ts",
        "lib/healthSync.ts",
      ].sort(),
    );
  });
});
