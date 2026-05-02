/**
 * @vitest-environment node
 *
 * Integration tests for POST /api/imports/mfp-csv — the MFP-refugee
 * bulk-import route. Auth, rate limit, file size, parse failure, and
 * the happy path. We mock the supabase service-role client at the
 * module boundary so these tests don't touch the network.
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

function reqWithFile(body: FormData | null): Request {
  return new Request("http://localhost/api/imports/mfp-csv", {
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

  it("returns 401 when unauthenticated", async () => {
    mockUserId.mockResolvedValue(null);
    const res = await POST(reqWithFile(csvForm(CSV_FIXTURE)));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("unauthorized");
  });

  it("returns 429 when rate-limited", async () => {
    mockUserId.mockResolvedValue("u1");
    mockRateLimit.mockResolvedValue({
      ok: false,
      remaining: 0,
      resetAtMs: Date.now() + 60_000,
      retryAfterSec: 60,
      ip: "1.1.1.1",
    });
    const res = await POST(reqWithFile(csvForm(CSV_FIXTURE)));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
    const json = await res.json();
    expect(json.error).toBe("rate_limited");
  });

  it("returns 400 when no file is attached", async () => {
    mockUserId.mockResolvedValue("u1");
    const fd = new FormData();
    const res = await POST(reqWithFile(fd));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("missing_file");
  });

  it("returns 413 when the file exceeds the byte cap", async () => {
    mockUserId.mockResolvedValue("u1");
    // Allocate enough bytes to actually trip the size cap. 5MB + a few
    // bytes is cheap in modern Node tests; the alternative (mocking
    // File/Blob `size`) doesn't survive the FormData → Request →
    // undici round-trip, which strips off any monkey-patched getters
    // and reads the underlying byte length.
    const big = "x".repeat(MFP_IMPORT_BYTE_CAP + 16);
    const fd = new FormData();
    fd.append("file", new Blob([big], { type: "text/csv" }), "huge.csv");
    const res = await POST(reqWithFile(fd));
    expect(res.status).toBe(413);
    expect((await res.json()).error).toBe("file_too_large");
  });

  it("returns 422 when the CSV has no usable rows (missing required columns)", async () => {
    mockUserId.mockResolvedValue("u1");
    const garbage = "Calories,Carbs,Fat,Protein\n300,30,10,40";
    const res = await POST(reqWithFile(csvForm(garbage)));
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe("no_rows");
    expect(json.warnings).toContain("missing_required_columns");
  });

  it("returns 422 when every row is missing the calories cell", async () => {
    mockUserId.mockResolvedValue("u1");
    const noCal = [
      "Date,Meal,Food,Calories,Carbs,Fat,Protein",
      "2024-08-12,Breakfast,Oats,,68,10,14",
      "2024-08-12,Lunch,Salad,,42,18,52",
    ].join("\n");
    const res = await POST(reqWithFile(csvForm(noCal)));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("no_valid_rows");
  });

  it("returns 503 when the service-role client is unavailable", async () => {
    mockUserId.mockResolvedValue("u1");
    mockServiceRole.mockReturnValue(null);
    const res = await POST(reqWithFile(csvForm(CSV_FIXTURE)));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("server_misconfigured");
  });

  it("returns 200 with imported count, sample, and unmatched on the happy path", async () => {
    mockUserId.mockResolvedValue("u1");
    const stub = makeServiceRoleStub({ insertedPerBatch: 3 });
    mockServiceRole.mockReturnValue(stub);

    const res = await POST(reqWithFile(csvForm(CSV_FIXTURE)));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.imported).toBe(3);
    expect(json.unmatched).toBe(0);
    expect(json.truncated).toBe(false);
    expect(Array.isArray(json.sample)).toBe(true);
    // Sample is capped at 5 — fixture has 3 rows, so 3.
    expect(json.sample).toHaveLength(3);
    expect(json.sample[0]).toMatchObject({
      date: "2024-08-12",
      meal: "breakfast",
      name: "Oats",
      calories: 420,
    });

    // Verify `source: "mfp_import"` is set on every row written.
    expect(stub._upsert).toHaveBeenCalledTimes(1);
    const sentBatch = (stub._upsert as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(sentBatch).toHaveLength(3);
    expect(sentBatch.every((r: { source: string }) => r.source === "mfp_import")).toBe(true);
    expect(sentBatch.every((r: { user_id: string }) => r.user_id === "u1")).toBe(true);
  });

  it("returns 500 if the database insert fails", async () => {
    mockUserId.mockResolvedValue("u1");
    const stub = makeServiceRoleStub({
      insertedPerBatch: 0,
      error: { message: "violates fk constraint" },
    });
    mockServiceRole.mockReturnValue(stub);

    const res = await POST(reqWithFile(csvForm(CSV_FIXTURE)));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("insert_failed");
  });

  it("counts an unmatched row when a CSV row is missing calories (cannot insert)", async () => {
    mockUserId.mockResolvedValue("u1");
    const mixed = [
      "Date,Meal,Food,Calories,Carbs,Fat,Protein",
      "2024-08-12,Breakfast,Oats,420,68,10,14",
      // Calories empty → not inserted, counts as unmatched.
      "2024-08-12,Lunch,Salad,,42,18,52",
      "2024-08-12,Dinner,Chicken,620,52,22,48",
    ].join("\n");

    const stub = makeServiceRoleStub({ insertedPerBatch: 2 });
    mockServiceRole.mockReturnValue(stub);

    const res = await POST(reqWithFile(csvForm(mixed)));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.imported).toBe(2);
    expect(json.unmatched).toBe(1);
  });

  it("uses upsert with onConflict so a re-uploaded file is idempotent", async () => {
    mockUserId.mockResolvedValue("u1");
    const stub = makeServiceRoleStub({ insertedPerBatch: 3 });
    mockServiceRole.mockReturnValue(stub);

    await POST(reqWithFile(csvForm(CSV_FIXTURE)));
    // The upsert call's second arg locks the dedup contract.
    const callArgs = (stub._upsert as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[1]).toMatchObject({
      onConflict: "user_id,source,source_id",
      ignoreDuplicates: true,
    });
  });
});
