/**
 * Mobile `exportEverythingToFile` helper — 2026-04-30 lock-in
 * counter. Drives the new server-authoritative export flow:
 *
 *   1. Hits `/api/export/me` with the bearer token from Supabase.
 *   2. Writes the body to the iOS cache directory.
 *   3. Returns the `file://` URI for the caller to hand to the iOS
 *      share sheet via `Share.share({ url })`.
 *
 * Tests (vitest under node — no RN/jsdom needed for this pure
 * helper) cover:
 *   - 401 maps to `{ ok: false, reason: "not_authenticated" }`.
 *   - 429 maps to `{ ok: false, reason: "rate_limited" }` with
 *     guidance copy.
 *   - 200 happy path writes to `cacheDirectory` and returns the
 *     file URI + size.
 *   - Network failure maps to `{ ok: false, reason: "network" }`.
 *   - Filename helper trims long UUIDs to keep the Files-app row
 *     readable.
 */

// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  exportEverythingToFile,
  _buildExportFilename,
  isExportEverythingSupported,
} from "../../lib/exportEverything";
import { authedFetch } from "../../lib/authedFetch";

// Mock the api-base + auth helper before importing the helper so
// the helper picks up the mocks at module load.
vi.mock("@/lib/supprWeb", () => ({
  getSupprApiBase: () => "https://api.suppr-club.test",
  getSupprWebBase: () => "https://suppr-club.test",
}));
vi.mock("@/lib/authedFetch", () => ({
  authedFetch: vi.fn(),
}));

// `expo-file-system` ships its src as ESM-in-CJS, which vitest's
// vmThreads pool can't load directly. Mock at the module level so
// we never resolve the real package; the helper's dynamic
// `require("expo-file-system")` picks up this mock instead.
const mockedWrite = vi.fn();
vi.mock("expo-file-system", () => ({
  default: {
    cacheDirectory: "file:///tmp/cache/",
    writeAsStringAsync: mockedWrite,
  },
  cacheDirectory: "file:///tmp/cache/",
  writeAsStringAsync: mockedWrite,
}));

const mockedFetch = authedFetch as ReturnType<typeof vi.fn>;

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("exportEverythingToFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns not_authenticated when called without a userId", async () => {
    const result = await exportEverythingToFile("");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("not_authenticated");
    }
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("maps a 401 to not_authenticated with a session-expired message", async () => {
    mockedFetch.mockResolvedValue(jsonResponse(401, { ok: false, error: "unauthorized" }));
    const result = await exportEverythingToFile("user-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("not_authenticated");
      expect(result.status).toBe(401);
      expect(result.message).toMatch(/[Ss]ession expired/);
    }
  });

  it("maps a 429 to rate_limited with one-per-minute guidance", async () => {
    mockedFetch.mockResolvedValue(
      jsonResponse(429, { ok: false, error: "rate_limited" }, { "retry-after": "30" }),
    );
    const result = await exportEverythingToFile("user-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("rate_limited");
      expect(result.status).toBe(429);
      expect(result.message).toMatch(/once per minute/);
    }
  });

  it("maps a network throw to reason: 'network'", async () => {
    mockedFetch.mockRejectedValue(new Error("offline"));
    const result = await exportEverythingToFile("user-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("network");
      expect(result.message).toMatch(/offline/);
    }
  });

  it("writes the body to the cache directory and returns a file URI on 200", async () => {
    const body = JSON.stringify({ schemaVersion: 1, recipes: [], mealLog: [] });
    mockedFetch.mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    mockedWrite.mockResolvedValue(undefined);

    const result = await exportEverythingToFile("11111111-2222-3333-4444-555555555555");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fileUri.startsWith("file:///tmp/cache/")).toBe(true);
      expect(result.fileUri.endsWith(".json")).toBe(true);
      expect(result.sizeBytes).toBe(body.length);
      expect(result.filename).toMatch(/^suppr-export-11111111-\d{4}-\d{2}-\d{2}\.json$/);
    }
    expect(mockedWrite).toHaveBeenCalledTimes(1);
    const writeArgs = mockedWrite.mock.calls[0];
    expect(writeArgs?.[0]).toBe(result.ok ? result.fileUri : "");
    expect(writeArgs?.[1]).toBe(body);
  });

  it("maps a 503 to service_unavailable", async () => {
    mockedFetch.mockResolvedValue(jsonResponse(503, { ok: false, error: "service_unavailable" }));
    const result = await exportEverythingToFile("user-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("service_unavailable");
    }
  });
});

describe("_buildExportFilename", () => {
  it("trims long UUIDs to the first 8 chars and stamps the date", () => {
    const filename = _buildExportFilename("11111111-2222-3333-4444-555555555555");
    expect(filename.startsWith("suppr-export-11111111-")).toBe(true);
    expect(filename.endsWith(".json")).toBe(true);
  });

  it("handles short / synthetic ids without crashing", () => {
    const filename = _buildExportFilename("u1");
    expect(filename.startsWith("suppr-export-u1-")).toBe(true);
  });
});

describe("isExportEverythingSupported", () => {
  it("returns a boolean — guards against the row appearing on Android dev builds", () => {
    expect(typeof isExportEverythingSupported()).toBe("boolean");
  });
});
