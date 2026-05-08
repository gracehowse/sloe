/**
 * Phase 0.5 (`docs/decisions/2026-05-08-food-correction-verification-pipeline.md`)
 * — Suppr migrated from OpenAI GPT-4o vision to Anthropic Claude
 * Sonnet 4.6 vision so the platform has a single vision provider going
 * forward (also used for label-photo verify in the food-correction
 * pipeline).
 *
 * 2026-05-08 (Phase 0.5b) — vendor logic was extracted into the shared
 * `src/lib/server/aiProvider.ts` helper so all 6 AI-using routes
 * (photo-log, voice-log, recipe-import, recipe-import/caption,
 * recipe-import/image, social-recipe extraction) call the same
 * vendor-selection code. Pin the helper, not each individual route.
 *
 * Static-analysis pin asserting:
 *   - Helper declares `claude-sonnet-4-6` model id
 *   - Helper hits `https://api.anthropic.com/v1/messages` for Claude
 *   - Helper prefers `ANTHROPIC_API_KEY`, falls back to `OPENAI_API_KEY`
 *   - Helper uses prefill `{` for guaranteed JSON output
 *   - Helper handles base64 + media_type separately for Claude vision
 *   - OpenAI fallback is still wired (transition safety) — relax once
 *     cutover is confirmed
 *   - Each migrated route imports from the helper (not inline fetches)
 *
 * If a future agent rolls back to OpenAI-only or duplicates the vendor
 * logic in a route, this test surfaces the regression.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(__dirname, "..", "..");

function read(rel: string): string {
  return readFileSync(resolve(REPO, rel), "utf8");
}

describe("Phase 0.5b — shared aiProvider helper", () => {
  // Strip block comments only — URL string literals like
  // `https://api.anthropic.com` contain `//` which the line-comment
  // regex would eat.
  const SRC = read("src/lib/server/aiProvider.ts").replace(/\/\*[\s\S]*?\*\//g, "");

  it("declares a dated Claude Sonnet model id as the default (alias-free)", () => {
    // 2026-05-08 hotfix: aliases like `claude-sonnet-4-6` 400'd via the
    // direct REST API on Grace's Anthropic account. Pin a dated model
    // id so we never regress to an alias.
    expect(SRC).toMatch(/CLAUDE_MODEL_DEFAULT\s*=\s*["']claude-sonnet-4-\d-\d{8}["']/);
  });

  it("hits the Anthropic Messages endpoint", () => {
    expect(SRC).toMatch(/https:\/\/api\.anthropic\.com\/v1\/messages/);
  });

  it("prefers ANTHROPIC_API_KEY when both keys are set", () => {
    expect(SRC).toMatch(/process\.env\.ANTHROPIC_API_KEY/);
    expect(SRC).toMatch(/process\.env\.OPENAI_API_KEY/);
    // Selection logic: claude key triggers Claude, else fallback.
    expect(SRC).toMatch(/if\s*\(\s*claudeKey\s*\)\s*return\s+callClaude/);
  });

  it("emits vendor-neutral ai_* error codes (not openai_* in response shape)", () => {
    for (const code of [
      "ai_timeout",
      "ai_network_error",
      "ai_http_error",
      "ai_rate_limited",
      "ai_not_configured",
    ]) {
      expect(SRC, `aiProvider must declare ${code}`).toContain(code);
    }
  });

  it("uses the prefill technique to guarantee Claude returns JSON", () => {
    // Anthropic doesn't have OpenAI-style JSON object mode. Prefilling
    // the assistant message with `{` forces the response to start with
    // a JSON object. The helper prepends `{` back before returning.
    expect(SRC).toMatch(/role:\s*["']assistant["'][\s\S]{0,200}content:\s*["']\{["']/);
  });

  it("handles base64 + media_type separately for Claude vision (not data URL)", () => {
    expect(SRC).toMatch(/source:\s*\{\s*type:\s*["']base64["']/);
    expect(SRC).toMatch(/media_type:\s*\w+/);
  });

  it("OpenAI fallback is still wired (transition safety)", () => {
    // Until cutover is confirmed, the OpenAI path stays. After the
    // migration bakes for one TestFlight cycle and Grace confirms
    // parity, the OpenAI helper functions can be deleted and this
    // assertion relaxed.
    expect(SRC).toMatch(/https:\/\/api\.openai\.com\/v1\/chat\/completions/);
    expect(SRC).toMatch(/OPENAI_(?:VISION_)?MODEL_DEFAULT\s*=\s*["']gpt-/);
  });

  it("exposes both callAiVision and callAiText", () => {
    expect(SRC).toMatch(/export\s+async\s+function\s+callAiVision/);
    expect(SRC).toMatch(/export\s+async\s+function\s+callAiText/);
  });

  it("exposes activeVendor() for routes that need to gate on AI availability", () => {
    expect(SRC).toMatch(/export\s+function\s+activeVendor/);
  });
});

describe("Phase 0.5b — migrated routes import from the shared helper", () => {
  const ROUTES = [
    "app/api/nutrition/photo-log/route.ts",
    "app/api/nutrition/voice-log/route.ts",
    "app/api/recipe-import/image/route.ts",
    "src/lib/recipe-import/extractSocialRecipe.ts",
  ];

  it.each(ROUTES)("%s imports from the shared aiProvider helper", (rel) => {
    const src = read(rel);
    expect(src, `${rel} should import from aiProvider`).toMatch(
      /from\s+["'][^"']*aiProvider["']/,
    );
  });

  it.each(ROUTES)("%s does not contain a direct OpenAI fetch", (rel) => {
    const src = read(rel).replace(/\/\*[\s\S]*?\*\//g, "");
    expect(src, `${rel} should not have direct openai.com fetch`).not.toMatch(
      /fetch\s*\(\s*["']https:\/\/api\.openai\.com/,
    );
  });

  it.each(ROUTES)("%s does not contain a direct Anthropic fetch (helper-only)", (rel) => {
    const src = read(rel).replace(/\/\*[\s\S]*?\*\//g, "");
    expect(src, `${rel} should not have direct anthropic.com fetch`).not.toMatch(
      /fetch\s*\(\s*["']https:\/\/api\.anthropic\.com/,
    );
  });
});
