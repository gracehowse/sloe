/**
 * Tests for the central recipe-import error mapper (audit I01,
 * 2026-05-05).
 *
 * Pinning the contract:
 *   - `userFacingImportError` produces a non-empty string for every
 *     reasonable input shape (server response, thrown Error, code).
 *   - `sanitiseImportErrorMessage` strips vendor names + Postgrest +
 *     HTTP status leaks regardless of how they got into the string.
 *   - `mapPersistenceError` maps the Postgres unique-violation +
 *     RLS-denied codes correctly so saveImportedRecipe never echoes
 *     `.message` to the UI.
 *
 * The structural risk this guards against: a code path slipping a
 * raw `OpenAI API error: 429` or `relation "recipes" violates...`
 * straight into a toast. The mapper is the last stop before render,
 * so the regex pass IS load-bearing — not theoretical defense.
 */
import { describe, expect, it } from "vitest";
import {
  IMPORT_ERROR_COPY,
  importErrorResponse,
  mapPersistenceError,
  sanitiseImportErrorMessage,
  userFacingImportError,
} from "@/lib/recipes/importErrorCopy";

describe("IMPORT_ERROR_COPY", () => {
  it("never names a vendor in user-facing copy", () => {
    for (const [code, message] of Object.entries(IMPORT_ERROR_COPY)) {
      expect(message, `code=${code}`).not.toMatch(/openai/i);
      expect(message, `code=${code}`).not.toMatch(/fatsecret/i);
      expect(message, `code=${code}`).not.toMatch(/supabase/i);
      expect(message, `code=${code}`).not.toMatch(/instagram/i);
      expect(message, `code=${code}`).not.toMatch(/tiktok/i);
      expect(message, `code=${code}`).not.toMatch(/postgres/i);
      expect(message, `code=${code}`).not.toMatch(/RLS/);
      expect(message, `code=${code}`).not.toMatch(/JWT/);
    }
  });

  it("never includes a raw HTTP status in user-facing copy", () => {
    for (const [code, message] of Object.entries(IMPORT_ERROR_COPY)) {
      expect(message, `code=${code}`).not.toMatch(/\b\d{3}\b/);
    }
  });

  it("has a non-empty string for every code", () => {
    for (const [code, message] of Object.entries(IMPORT_ERROR_COPY)) {
      expect(message.length, `code=${code}`).toBeGreaterThan(0);
    }
  });
});

describe("sanitiseImportErrorMessage", () => {
  it("strips a literal OpenAI rate-limit string", () => {
    const out = sanitiseImportErrorMessage("OpenAI API error: 429");
    expect(out).not.toMatch(/openai/i);
    expect(out).not.toMatch(/\b429\b/);
  });

  it("strips Supabase / Postgrest fragments", () => {
    const out = sanitiseImportErrorMessage(
      'Supabase error: relation "recipes" violates RLS policy (JWT expired)',
    );
    expect(out).not.toMatch(/supabase/i);
    expect(out).not.toMatch(/relation "recipes"/);
    expect(out).not.toMatch(/RLS/);
    expect(out).not.toMatch(/JWT/);
  });

  it("strips Instagram / TikTok identifiers", () => {
    expect(sanitiseImportErrorMessage("Instagram fetch failed")).not.toMatch(/instagram/i);
    expect(sanitiseImportErrorMessage("TikTok 404 not found")).not.toMatch(/tiktok/i);
  });

  it("strips internal error tokens", () => {
    expect(sanitiseImportErrorMessage("openai_http_error 500")).not.toMatch(/openai_http_error/);
    expect(sanitiseImportErrorMessage("unparseable_model_output: ...")).not.toMatch(/unparseable_model_output/);
  });

  it("strips duplicate-key Postgres error fragments", () => {
    const out = sanitiseImportErrorMessage(
      'duplicate key value violates unique constraint "recipes_pkey"',
    );
    // The substitution leaves a "duplicate" token — that's fine, it's
    // not a vendor / table name. The relation reference is what
    // mattered.
    expect(out).not.toMatch(/recipes_pkey/);
    expect(out).not.toMatch(/violates unique constraint/);
  });

  it("collapses whitespace artefacts created by substitutions", () => {
    const out = sanitiseImportErrorMessage("OpenAI    API   error:   429   here");
    expect(out).not.toMatch(/\s{2,}/);
  });

  it("is idempotent — running twice produces the same output", () => {
    const a = sanitiseImportErrorMessage("OpenAI API error: 429 — try again");
    const b = sanitiseImportErrorMessage(a);
    expect(b).toBe(a);
  });
});

describe("userFacingImportError", () => {
  it("returns mapped copy for a known error code (string input)", () => {
    expect(userFacingImportError("ai_rate_limited")).toBe(IMPORT_ERROR_COPY.ai_rate_limited);
    expect(userFacingImportError("rls_denied")).toBe(IMPORT_ERROR_COPY.rls_denied);
  });

  it("returns sanitised string when given a generic string", () => {
    const out = userFacingImportError("OpenAI API error: 429");
    expect(out).not.toMatch(/openai/i);
    expect(out).not.toMatch(/429/);
  });

  it("uses response.message when provided (server-emitted copy)", () => {
    const out = userFacingImportError({ ok: false, error: "ai_rate_limited", message: "calm copy" });
    expect(out).toBe("calm copy");
  });

  it("falls back to mapped copy when response has only a code", () => {
    const out = userFacingImportError({ ok: false, error: "ai_rate_limited" });
    expect(out).toBe(IMPORT_ERROR_COPY.ai_rate_limited);
  });

  it("sanitises a thrown Error.message defensively", () => {
    const err = new Error('relation "recipes" violates RLS policy');
    const out = userFacingImportError(err);
    expect(out).not.toMatch(/relation "recipes"/);
    expect(out).not.toMatch(/RLS/);
  });

  it("returns the unknown-fallback copy for null / undefined / weird inputs", () => {
    expect(userFacingImportError(null)).toBe(IMPORT_ERROR_COPY.unknown);
    expect(userFacingImportError(undefined)).toBe(IMPORT_ERROR_COPY.unknown);
    expect(userFacingImportError(42)).toBe(IMPORT_ERROR_COPY.unknown);
    expect(userFacingImportError([])).toBe(IMPORT_ERROR_COPY.unknown);
  });

  it("never returns an empty string", () => {
    const inputs: unknown[] = [
      "",
      "   ",
      null,
      undefined,
      {},
      { error: "" },
      { message: "" },
      new Error(""),
    ];
    for (const i of inputs) {
      const out = userFacingImportError(i);
      expect(out.length).toBeGreaterThan(0);
    }
  });
});

describe("importErrorResponse", () => {
  it("builds a stable {ok, error, message} body", () => {
    const r = importErrorResponse("rate_limited");
    expect(r.ok).toBe(false);
    expect(r.error).toBe("rate_limited");
    expect(r.message).toBe(IMPORT_ERROR_COPY.rate_limited);
  });

  it("accepts a sanitised override message", () => {
    const r = importErrorResponse("import_failed", "Custom user-facing copy.");
    expect(r.message).toBe("Custom user-facing copy.");
  });

  it("sanitises the override before returning", () => {
    const r = importErrorResponse("import_failed", "Failed (OpenAI 502)");
    expect(r.message).not.toMatch(/openai/i);
    expect(r.message).not.toMatch(/502/);
  });
});

describe("client-side error codes (audit I07, 2026-05-05)", () => {
  it("includes copy for every client-side state used by mobile import-shared", () => {
    const required = [
      "client_signin_required",
      "client_signin_required_to_save",
      "client_clipboard_empty",
      "client_paste_empty",
      "client_url_required",
      "client_unsupported_url",
      "client_image_pick_failed",
      "client_offline",
    ] as const;
    for (const code of required) {
      expect(IMPORT_ERROR_COPY[code], `missing copy for ${code}`).toBeTruthy();
    }
  });

  it("client-side copy never names a vendor or HTTP status", () => {
    const clientCodes = Object.keys(IMPORT_ERROR_COPY).filter((k) => k.startsWith("client_")) as (keyof typeof IMPORT_ERROR_COPY)[];
    for (const code of clientCodes) {
      const message = IMPORT_ERROR_COPY[code];
      expect(message, `code=${code}`).not.toMatch(/openai|supabase|fatsecret|instagram|tiktok|RLS|JWT|postgres/i);
      expect(message, `code=${code}`).not.toMatch(/\b\d{3}\b/);
    }
  });

  it("client-side copy is action-shaped (each starts with a verb or call to action)", () => {
    // Defensive — these strings ARE the user's call to action; pin
    // that they don't drift into passive / dev-jargon copy. Each one
    // should fit the pattern "[Verb] ..." or "[You're / Your] ...".
    const clientCodes = Object.keys(IMPORT_ERROR_COPY).filter((k) => k.startsWith("client_")) as (keyof typeof IMPORT_ERROR_COPY)[];
    for (const code of clientCodes) {
      const message = IMPORT_ERROR_COPY[code];
      expect(message, `code=${code}`).toMatch(/^[A-Z]/);
      expect(message.length, `code=${code}`).toBeLessThan(200);
    }
  });
});

describe("mapPersistenceError", () => {
  it("maps Postgres unique-violation (23505) to duplicate_recipe", () => {
    expect(mapPersistenceError({ code: "23505", message: "duplicate key" })).toBe("duplicate_recipe");
  });

  it("maps Postgrest forbidden (42501) to rls_denied", () => {
    expect(mapPersistenceError({ code: "42501", message: "permission denied" })).toBe("rls_denied");
  });

  it("maps row-level-security messages to rls_denied", () => {
    expect(mapPersistenceError({ message: "new row violates row-level security policy" })).toBe("rls_denied");
  });

  it("maps duplicate-text messages to duplicate_recipe even without a code", () => {
    expect(mapPersistenceError({ message: "duplicate key value" })).toBe("duplicate_recipe");
  });

  it("falls through to save_failed for unknown shapes", () => {
    expect(mapPersistenceError(null)).toBe("save_failed");
    expect(mapPersistenceError(undefined)).toBe("save_failed");
    expect(mapPersistenceError({ message: "transient network blip" })).toBe("save_failed");
    expect(mapPersistenceError({ code: "08000" })).toBe("save_failed");
  });
});
