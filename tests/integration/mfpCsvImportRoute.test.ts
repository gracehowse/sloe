/**
 * @vitest-environment node
 *
 * Integration tests for `POST /api/imports/mfp-csv` — the MFP-refugee
 * bulk-import route. Auth, rate limit, file size, parse failure,
 * partial failure (DB error mid-batch), and the happy path. We mock
 * the supabase service-role client at the module boundary so these
 * tests don't touch the network.
 *
 * Two-phase contract (ENG-1234): `?mode=preview` (the default — also what
 * an absent/invalid `mode` resolves to) parses + returns a sample with NO
 * insert and NO rate-limit consumption; `?mode=commit` re-parses + inserts
 * and is the only path that touches the rate limiter or the DB.
 *
 * Node environment so multipart `Request.formData()` round-trips
 * through undici's parser instead of jsdom's incomplete impl.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/serverAnonClient", () => ({
  getUserIdFromRequest: vi.fn(),
  createSupabaseServiceRoleClient: vi.fn(),
}));

vi.mock("@/lib/server/rateLimit", () => ({
  rateLimit: vi.fn(async () => ({ ok: true, retryAfterSec: 0 })),
}));

import { POST } from "../../app/api/imports/mfp-csv/route";
import { MFP_IMPORT_BYTE_CAP } from "@/lib/imports/mfpCsvLimits";
import {
  getUserIdFromRequest,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/serverAnonClient";
import { rateLimit } from "@/lib/server/rateLimit";

const mockUserId = getUserIdFromRequest as ReturnType<typeof vi.fn>;
const mockServiceRole = createSupabaseServiceRoleClient as ReturnType<
  typeof vi.fn
>;
const mockRateLimit = rateLimit as ReturnType<typeof vi.fn>;

const CSV_FIXTURE = [
  "Date,Meal,Food,Calories,Carbs,Fat,Protein,Sodium,Sugar",
  "2024-08-12,Breakfast,Oats,420,68,10,14,180,18",
  "2024-08-12,Lunch,Salad,540,42,18,52,820,8",
  "2024-08-12,Dinner,Chicken,620,52,22,48,910,7",
].join("\n");

function reqWithFile(
  body: FormData | null,
  mode?: "preview" | "commit",
): Request {
  const url = mode
    ? `http://localhost/api/imports/mfp-csv?mode=${mode}`
    : "http://localhost/api/imports/mfp-csv";
  return new Request(url, {
    method: "POST",
    body: body ?? undefined,
  });
}

function csvForm(content: string): FormData {
  const fd = new FormData();
  fd.append("file", new Blob([content], { type: "text/csv" }), "mfp.csv");
  return fd;
}

/**
 * Build a minimal Supabase upsert chain that returns `{ data, error }`.
 * `data` is an array of `{ id }` rows so the route can count inserted
 * entries. The tests pass `length` to control how many were "inserted".
 */
function makeServiceRoleStub(opts: {
  insertedPerBatch: number;
  error?: { message: string } | null;
}) {
  const upsert = vi.fn().mockReturnThis();
  const select = vi.fn().mockResolvedValue({
    data: Array.from({ length: opts.insertedPerBatch }, (_, i) => ({
      id: `row-${i}`,
    })),
    error: opts.error ?? null,
  });
  return {
    from: vi.fn(() => ({ upsert, select })),
    _upsert: upsert,
    _select: select,
  };
}

describe("POST /api/imports/mfp-csv", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimit.mockResolvedValue({
      ok: true,
      remaining: 4,
      resetAtMs: Date.now() + 60_000,
    });
  });

  // Scenario 1: unauthenticated (checked before mode is even read).
  it("returns 401 when unauthenticated", async () => {
    mockUserId.mockResolvedValue(null);
    const res = await POST(reqWithFile(csvForm(CSV_FIXTURE), "commit"));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("unauthorized");
  });

  // Scenario 2: rate-limited — COMMITS only.
  it("returns 429 when a commit is rate-limited", async () => {
    mockUserId.mockResolvedValue("u1");
    mockRateLimit.mockResolvedValue({
      ok: false,
      remaining: 0,
      resetAtMs: Date.now() + 60_000,
      retryAfterSec: 60,
      ip: "1.1.1.1",
    });
    const res = await POST(reqWithFile(csvForm(CSV_FIXTURE), "commit"));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
    const json = await res.json();
    expect(json.error).toBe("rate_limited");
  });

  // Scenario 3 (CSV doesn't match any registered adapter).
  it("returns 422 unknown_source when no adapter recognises the header row", async () => {
    mockUserId.mockResolvedValue("u1");
    // No `Meal` / `Food` (MFP), no `Quantity` / `Units` (Lose It),
    // no `Day` / `Group` / `Food Name` (Cronometer). Detection fails.
    const garbage = "Calories,Carbs,Fat,Protein\n300,30,10,40";
    const res = await POST(reqWithFile(csvForm(garbage), "commit"));
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe("unknown_source");
  });

  // Scenario 4: oversize file.
  it("returns 413 when the file exceeds the byte cap", async () => {
    mockUserId.mockResolvedValue("u1");
    // Allocate enough bytes to actually trip the size cap. 5MB + a
    // few bytes is cheap in modern Node tests; the alternative
    // (mocking File/Blob `size`) doesn't survive the FormData ->
    // Request -> undici round-trip, which strips off any
    // monkey-patched getters and reads the underlying byte length.
    const big = "x".repeat(MFP_IMPORT_BYTE_CAP + 16);
    const fd = new FormData();
    fd.append("file", new Blob([big], { type: "text/csv" }), "huge.csv");
    const res = await POST(reqWithFile(fd, "commit"));
    expect(res.status).toBe(413);
    expect((await res.json()).error).toBe("file_too_large");
  });

  // Scenario 5: happy path — commit success.
  it("returns 200 with imported count, sample, and adapter source=mfp on commit", async () => {
    mockUserId.mockResolvedValue("u1");
    const stub = makeServiceRoleStub({ insertedPerBatch: 3 });
    mockServiceRole.mockReturnValue(stub);

    const res = await POST(reqWithFile(csvForm(CSV_FIXTURE), "commit"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.mode).toBe("commit");
    expect(json.imported).toBe(3);
    expect(json.unmatched).toBe(0);
    expect(json.truncated).toBe(false);
    expect(Array.isArray(json.sample)).toBe(true);
    expect(json.sample).toHaveLength(3);
    expect(json.sample[0]).toMatchObject({
      date: "2024-08-12",
      meal: "breakfast",
      name: "Oats",
      calories: 420,
    });

    // ENG-674: DB `source` is canonical (`manual` for all CSV imports);
    // adapter id stays on the JSON `source` field for UI/debugging.
    expect(stub._upsert).toHaveBeenCalledTimes(1);
    const sentBatch = (stub._upsert as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(sentBatch).toHaveLength(3);
    expect(json.source).toBe("mfp");
    expect(
      sentBatch.every((r: { source: string }) => r.source === "manual"),
    ).toBe(true);
    expect(
      sentBatch.every((r: { user_id: string }) => r.user_id === "u1"),
    ).toBe(true);
    expect(
      sentBatch.every((r: { source_id: string }, i: number) =>
        r.source_id === `u1:2024-08-12:${i}`,
      ),
    ).toBe(true);
  });

  // Scenario 6: idempotent upsert (re-uploaded file).
  it("uses upsert with onConflict so a re-uploaded file is idempotent", async () => {
    mockUserId.mockResolvedValue("u1");
    const stub = makeServiceRoleStub({ insertedPerBatch: 3 });
    mockServiceRole.mockReturnValue(stub);

    await POST(reqWithFile(csvForm(CSV_FIXTURE), "commit"));
    // The upsert call's second arg locks the dedup contract.
    const callArgs = (stub._upsert as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[1]).toMatchObject({
      onConflict: "user_id,source,source_id",
      ignoreDuplicates: true,
    });
  });

  // Scenario 7: partial-failure — DB error after some rows; route
  // returns 500 with the partial `imported` count so the client knows
  // exactly how far we got. (No silent partial commits.)
  it("returns 500 with partial imported count when the DB insert fails", async () => {
    mockUserId.mockResolvedValue("u1");
    const stub = makeServiceRoleStub({
      insertedPerBatch: 0,
      error: { message: "violates fk constraint" },
    });
    mockServiceRole.mockReturnValue(stub);

    const res = await POST(reqWithFile(csvForm(CSV_FIXTURE), "commit"));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("insert_failed");
    expect(json.imported).toBe(0);
  });

  // ── Preview mode (ENG-1234) ──────────────────────────────────────────

  describe("preview mode (?mode=preview / default)", () => {
    it("parses + returns the sample and total WITHOUT inserting", async () => {
      mockUserId.mockResolvedValue("u1");
      // No service-role stub needed — preview must never reach the DB.
      const res = await POST(reqWithFile(csvForm(CSV_FIXTURE), "preview"));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.mode).toBe("preview");
      expect(json.source).toBe("mfp");
      expect(json.total).toBe(3);
      expect(json.unmatched).toBe(0);
      expect(json.truncated).toBe(false);
      expect(json.sample).toHaveLength(3);
      expect(json.sample[0]).toMatchObject({ meal: "breakfast", name: "Oats" });
      // The DB layer was never touched.
      expect(mockServiceRole).not.toHaveBeenCalled();
    });

    it("treats an absent mode as preview (fail-safe — no insert)", async () => {
      mockUserId.mockResolvedValue("u1");
      const res = await POST(reqWithFile(csvForm(CSV_FIXTURE)));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.mode).toBe("preview");
      expect(mockServiceRole).not.toHaveBeenCalled();
    });

    it("does NOT consume the rate limit on preview", async () => {
      mockUserId.mockResolvedValue("u1");
      await POST(reqWithFile(csvForm(CSV_FIXTURE), "preview"));
      expect(mockRateLimit).not.toHaveBeenCalled();
    });

    it("still surfaces unknown_source on preview", async () => {
      mockUserId.mockResolvedValue("u1");
      const garbage = "Calories,Carbs,Fat,Protein\n300,30,10,40";
      const res = await POST(reqWithFile(csvForm(garbage), "preview"));
      expect(res.status).toBe(422);
      expect((await res.json()).error).toBe("unknown_source");
    });
  });

  // Bonus coverage — auxiliary failure modes we want pinned.

  it("returns 400 when no file is attached", async () => {
    mockUserId.mockResolvedValue("u1");
    const fd = new FormData();
    const res = await POST(reqWithFile(fd, "commit"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("missing_file");
  });

  it("returns 422 when every row is missing the calories cell", async () => {
    mockUserId.mockResolvedValue("u1");
    const noCal = [
      "Date,Meal,Food,Calories,Carbs,Fat,Protein",
      "2024-08-12,Breakfast,Oats,,68,10,14",
      "2024-08-12,Lunch,Salad,,42,18,52",
    ].join("\n");
    const res = await POST(reqWithFile(csvForm(noCal), "commit"));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("no_valid_rows");
  });

  it("returns 503 when the service-role client is unavailable", async () => {
    mockUserId.mockResolvedValue("u1");
    mockServiceRole.mockReturnValue(null);
    const res = await POST(reqWithFile(csvForm(CSV_FIXTURE), "commit"));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("server_misconfigured");
  });

  it("counts an unmatched row when a CSV row is missing calories (cannot insert)", async () => {
    mockUserId.mockResolvedValue("u1");
    const mixed = [
      "Date,Meal,Food,Calories,Carbs,Fat,Protein",
      "2024-08-12,Breakfast,Oats,420,68,10,14",
      // Calories empty -> not inserted, counts as unmatched.
      "2024-08-12,Lunch,Salad,,42,18,52",
      "2024-08-12,Dinner,Chicken,620,52,22,48",
    ].join("\n");

    const stub = makeServiceRoleStub({ insertedPerBatch: 2 });
    mockServiceRole.mockReturnValue(stub);

    const res = await POST(reqWithFile(csvForm(mixed), "commit"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.imported).toBe(2);
    expect(json.unmatched).toBe(1);
  });

  // ENG-37 (2026-05-16) — auto-detect dispatches to the right adapter.
  // The URL stayed `/api/imports/mfp-csv` for backwards compat with
  // existing clients, but the route now serves every registered
  // adapter via `parseCsvImport` auto-detect.
  describe("auto-detect — multi-adapter coverage", () => {
    it("imports a MyFitnessPal CSV and canonicalizes DB source to manual", async () => {
      mockUserId.mockResolvedValue("u1");
      const stub = makeServiceRoleStub({ insertedPerBatch: 3 });
      mockServiceRole.mockReturnValue(stub);
      const res = await POST(reqWithFile(csvForm(CSV_FIXTURE), "commit"));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.source).toBe("mfp");
      expect(json.imported).toBe(3);
      const firstBatch = stub._upsert.mock.calls[0]?.[0];
      expect(firstBatch).toBeDefined();
      expect(Array.isArray(firstBatch)).toBe(true);
      for (const row of firstBatch as { source: string }[]) {
        expect(row.source).toBe("manual");
      }
    });

    it("imports a Lose It CSV and canonicalizes DB source to manual", async () => {
      mockUserId.mockResolvedValue("u1");
      const LOSEIT_CSV = [
        "Date,Name,Type,Quantity,Units,Calories,Fat (g),Cholesterol (mg),Sodium (mg),Carbohydrates (g),Fiber (g),Sugars (g),Protein (g)",
        "8/12/2024,Oats with banana,Breakfast,1,Serving,420,10,0,180,68,8,18,14",
        "8/12/2024,Chicken salad,Lunch,1,Bowl,540,18,85,820,42,6,8,52",
      ].join("\n");
      const stub = makeServiceRoleStub({ insertedPerBatch: 2 });
      mockServiceRole.mockReturnValue(stub);
      const res = await POST(reqWithFile(csvForm(LOSEIT_CSV), "commit"));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.source).toBe("lose-it");
      expect(json.imported).toBe(2);
      const firstBatch = stub._upsert.mock.calls[0]?.[0] as {
        source: string;
        date_key: string;
      }[];
      expect(firstBatch[0].source).toBe("manual");
      // Locale-date parsing — `8/12/2024` should canonicalise to ISO.
      expect(firstBatch[0].date_key).toBe("2024-08-12");
    });

    it("imports a Cronometer CSV and canonicalizes DB source to manual", async () => {
      mockUserId.mockResolvedValue("u1");
      const CRONOMETER_CSV = [
        "Day,Time,Group,Food Name,Amount,Energy (kcal),Fat (g),Protein (g),Carbs (g),Sodium (mg),Fiber (g),Sugars (g)",
        "2024-08-12,08:30,Breakfast,Oats with banana,1 cup,420,10,14,68,180,8,18",
        "2024-08-12,15:00,Snacks,Almonds,30 g,170,15,6,6,0,3,1",
      ].join("\n");
      const stub = makeServiceRoleStub({ insertedPerBatch: 2 });
      mockServiceRole.mockReturnValue(stub);
      const res = await POST(reqWithFile(csvForm(CRONOMETER_CSV), "commit"));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.source).toBe("cronometer");
      expect(json.imported).toBe(2);
      const firstBatch = stub._upsert.mock.calls[0]?.[0] as {
        source: string;
        name: string;
        recipe_title: string;
      }[];
      expect(firstBatch[0].source).toBe("manual");
      // Slot mapping: `Snacks` (Cronometer Group) → `snack` (canonical).
      expect(firstBatch[1].name).toBe("snack");
      // Two-word `Food Name` header column lands on `recipe_title`, not
      // on a different field due to column-shape drift.
      expect(firstBatch[1].recipe_title).toBe("Almonds");
    });
  });
});
