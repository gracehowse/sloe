/**
 * Phase 0.5 (`docs/decisions/2026-05-08-food-correction-verification-pipeline.md`)
 * — photo-log migrated from OpenAI GPT-4o vision to Anthropic Claude
 * Sonnet 4.6 vision so the platform has a single vision provider going
 * forward (also used for the upcoming label-photo verify endpoint in
 * the food-correction pipeline).
 *
 * Static-analysis pin asserting:
 *   - Route declares both `claude-sonnet-4-6` and a Claude API call
 *   - Route prefers `ANTHROPIC_API_KEY`, falls back to `OPENAI_API_KEY`
 *   - Route uses `https://api.anthropic.com/v1/messages` for Claude
 *   - Vendor-neutral `ai_*` error codes replace `openai_*` codes at
 *     the route level (clients keep `openai_*` aliases for the env-var
 *     transition window but the route emits `ai_*`).
 *
 * If a future agent rolls back to OpenAI-only, this test surfaces the
 * regression.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(__dirname, "..", "..");
const SRC = readFileSync(
  resolve(REPO, "app/api/nutrition/photo-log/route.ts"),
  "utf8",
);
// Strip block comments only — URL string literals like
// `https://api.anthropic.com` contain `//` which the line-comment regex
// would eat. Block-comment-strip is enough to avoid matching JSDoc
// blocks; the route has none of the per-line `// ai_*` sentinel comments
// that would create false positives anyway.
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "");

describe("Phase 0.5 — photo-log Claude vision migration", () => {
  it("declares the claude-sonnet-4-6 model id", () => {
    expect(CODE).toMatch(/CLAUDE_MODEL\s*=\s*["']claude-sonnet-4-6["']/);
  });

  it("hits the Anthropic Messages endpoint", () => {
    expect(CODE).toMatch(/https:\/\/api\.anthropic\.com\/v1\/messages/);
  });

  it("prefers ANTHROPIC_API_KEY when both keys are set", () => {
    // Vendor selection logic must read both keys and pick Claude when
    // it has a key. The OpenAI fallback path stays intact for the
    // env-var-driven transition window.
    expect(CODE).toMatch(/process\.env\.ANTHROPIC_API_KEY/);
    expect(CODE).toMatch(/process\.env\.OPENAI_API_KEY/);
    expect(CODE).toMatch(/useClaude\s*=\s*!!claudeKey/);
  });

  it("emits vendor-neutral ai_* error codes (not openai_* in response shape)", () => {
    // The route returns these codes in JSON responses; clients map them
    // to user-facing copy. Asserting `ai_*` is the SOURCE OF TRUTH
    // ensures we don't regress to OpenAI-specific codes.
    for (const code of [
      "ai_timeout",
      "ai_network_error",
      "ai_http_error",
      "ai_not_configured",
    ]) {
      expect(CODE, `photo-log route must emit ${code}`).toContain(code);
    }
  });

  it("uses the prefill technique to guarantee Claude returns JSON (no preamble)", () => {
    // Anthropic doesn't have an OpenAI-style JSON object mode. Prefilling
    // the assistant message with `{` forces the response to start with
    // a JSON object. The route prepends `{` back before parsing.
    expect(CODE).toMatch(/role:\s*["']assistant["'][\s\S]{0,200}content:\s*["']\{["']/);
  });

  it("handles base64 + media_type separately for Claude (not data URL)", () => {
    // Anthropic's image content block expects {type: "image", source:
    // {type: "base64", media_type, data}}. The route splits the data
    // URL because we can't pass it directly.
    expect(CODE).toMatch(/source:\s*\{\s*type:\s*["']base64["']/);
    expect(CODE).toMatch(/media_type:\s*\w+/);
  });

  it("OpenAI fallback is still wired (transition safety)", () => {
    // Until cutover is confirmed, the OpenAI path stays. After Phase 0.5
    // bakes for one TestFlight cycle and Grace confirms parity, the
    // OpenAI helper can be deleted and this assertion relaxed.
    expect(CODE).toMatch(/https:\/\/api\.openai\.com\/v1\/chat\/completions/);
    expect(CODE).toMatch(/OPENAI_MODEL\s*=\s*["']gpt-4o["']/);
  });
});
