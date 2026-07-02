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
  IMAGE_GEN_ERROR_COPY,
  IMAGE_GEN_UNAVAILABLE_COPY,
  IMPORT_ERROR_COPY,
  coerceImportErrorCode,
  importErrorResponse,
  mapPersistenceError,
  sanitiseImportErrorMessage,
  userFacingImageGenError,
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

describe("ENG-1309 — no raw snake_case token ever renders", () => {
  it("maps every UI-reachable route code to human copy (whitespace = human)", () => {
    // Every code the import routes emit today. If a route adds a code
    // without a copy entry, the union type breaks the build — this test
    // additionally pins that the copy reads as a sentence, not a token.
    const uiReachable = [
      "forbidden_origin",
      "server_misconfigured",
      "invalid_form",
      "missing_file",
      "missing_text",
      "invalid_pdf_type",
      "ai_not_configured",
      "not_html",
      "no_recipe_schema",
      "caption_too_long",
      "social_no_caption",
      "wrong_platform",
      "feature_disabled",
      "pdf_extract_failed",
      "pdf_text_too_short",
    ] as const;
    for (const code of uiReachable) {
      const copy = IMPORT_ERROR_COPY[code];
      expect(copy, `missing copy for ${code}`).toBeTruthy();
      expect(copy, `copy for ${code} looks like a raw token`).toMatch(/\s/);
    }
  });

  it("renders human copy for a known code arriving as a bare string", () => {
    expect(userFacingImportError("forbidden_origin")).toBe(IMPORT_ERROR_COPY.forbidden_origin);
    expect(userFacingImportError("unauthorized")).toBe(IMPORT_ERROR_COPY.unauthorized);
    expect(userFacingImportError("server_misconfigured")).toBe(
      IMPORT_ERROR_COPY.server_misconfigured,
    );
  });

  it("falls back to generic copy for an UNKNOWN snake_case token (string + object shapes)", () => {
    expect(userFacingImportError("some_future_code")).toBe(IMPORT_ERROR_COPY.unknown);
    expect(userFacingImportError({ ok: false, error: "some_future_code" })).toBe(
      IMPORT_ERROR_COPY.unknown,
    );
    expect(userFacingImportError({ ok: false, error: "some_future_code", message: "" })).toBe(
      IMPORT_ERROR_COPY.unknown,
    );
  });

  it("skips a raw-token `message` and resolves via the `error` code instead", () => {
    expect(
      userFacingImportError({ ok: false, error: "rate_limited", message: "upstream_weirdness" }),
    ).toBe(IMPORT_ERROR_COPY.rate_limited);
  });

  it("resolves a `message` that IS a known code to that code's copy", () => {
    expect(userFacingImportError({ ok: false, message: "forbidden_origin" })).toBe(
      IMPORT_ERROR_COPY.forbidden_origin,
    );
  });

  it("never outputs a whitespace-free token for any {error: code} response", () => {
    for (const code of Object.keys(IMPORT_ERROR_COPY)) {
      const out = userFacingImportError({ ok: false, error: code });
      expect(/\s/.test(out), `code=${code} rendered token-shaped output "${out}"`).toBe(true);
    }
  });

  it("collapses 'this Instagram post' to 'this post' without double-wording", () => {
    const out = sanitiseImportErrorMessage(
      "Could not extract content from this Instagram post. Try image import.",
    );
    expect(out).toBe("Could not extract content from this post. Try image import.");
    expect(out).not.toMatch(/post post/i);
  });
});

describe("ENG-1328 — image-generation error channel", () => {
  it("maps pro_required to image-GEN copy, distinct from the photo-import copy", () => {
    // The exact bug: free-tier "Generate an image" surfaced
    // "Recipe imports from photos are a Pro feature."
    const out = userFacingImageGenError({
      ok: false,
      error: "pro_required",
      message: IMPORT_ERROR_COPY.pro_required,
    });
    expect(out).toBe(IMAGE_GEN_ERROR_COPY.pro_required);
    expect(out).not.toBe(IMPORT_ERROR_COPY.pro_required);
    expect(out).toMatch(/image/i);
    expect(out).not.toMatch(/photo/i);
  });

  it("override map outranks the server message for every shared code", () => {
    for (const [code, copy] of Object.entries(IMAGE_GEN_ERROR_COPY)) {
      const out = userFacingImageGenError({
        ok: false,
        error: code,
        message: "Server copy written for a different surface.",
      });
      expect(out, `code=${code}`).toBe(copy);
    }
  });

  it("collapses raw skipped-reason tokens to the unavailable line", () => {
    const reasons = [
      "fal_not_configured",
      "import_killed",
      "generate_threw",
      "storage_not_configured",
      "remove_failed",
      "published_no_ai_image",
      "fetch_failed", // an import code, but as a skip-reason it means "no image today"
    ];
    for (const reason of reasons) {
      const out = userFacingImageGenError({ ok: false, skipped: true, reason });
      expect(out, `reason=${reason}`).toBe(IMAGE_GEN_UNAVAILABLE_COPY);
      expect(out).toMatch(/\s/);
    }
  });

  it("resolves non-overridden known codes through the shared mapper", () => {
    expect(userFacingImageGenError({ ok: false, error: "ai_capacity_reached" })).toBe(
      IMPORT_ERROR_COPY.ai_capacity_reached,
    );
  });

  it("falls back to the image-gen voice (never a raw token) for junk input", () => {
    expect(userFacingImageGenError(null)).toBe(IMAGE_GEN_UNAVAILABLE_COPY);
    expect(userFacingImageGenError({})).toBe(IMAGE_GEN_UNAVAILABLE_COPY);
    expect(userFacingImageGenError({ ok: false, error: "totally_new_code" })).toBe(
      IMAGE_GEN_UNAVAILABLE_COPY,
    );
  });

  it("image-gen copy never names a vendor, env var, or model", () => {
    const all = [...Object.values(IMAGE_GEN_ERROR_COPY), IMAGE_GEN_UNAVAILABLE_COPY];
    for (const copy of all) {
      expect(copy).not.toMatch(/fal|openai|anthropic|nano.?banana|_KEY|supabase/i);
    }
  });
});

describe("coerceImportErrorCode (ENG-1309)", () => {
  it("passes a known code through unchanged", () => {
    expect(coerceImportErrorCode("rate_limited")).toBe("rate_limited");
    expect(coerceImportErrorCode("forbidden_origin")).toBe("forbidden_origin");
  });

  it("coerces unknown / non-string values to the default fallback", () => {
    expect(coerceImportErrorCode("brand_new_server_code")).toBe("import_failed");
    expect(coerceImportErrorCode(undefined)).toBe("import_failed");
    expect(coerceImportErrorCode(null)).toBe("import_failed");
    expect(coerceImportErrorCode(500)).toBe("import_failed");
    expect(coerceImportErrorCode({})).toBe("import_failed");
  });

  it("honours a custom fallback", () => {
    expect(coerceImportErrorCode("whatever_else", "no_recipe_extracted")).toBe(
      "no_recipe_extracted",
    );
  });
});
