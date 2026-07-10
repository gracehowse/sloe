/**
 * ENG-1487 — `estimateInputTokens` pins the char→token heuristic used to
 * make text-call budget reservations reflect real prompt size (instead of
 * the blind `maxOutputTokens * 4` default that let the £50/day AI spend
 * cap under-count large client-supplied prompts).
 */
import { describe, it, expect } from "vitest";
import { estimateInputTokens } from "../../src/lib/server/aiProvider";

describe("estimateInputTokens", () => {
  it("is ~1 token per 4 characters", () => {
    expect(estimateInputTokens("a".repeat(4))).toBe(1);
    expect(estimateInputTokens("a".repeat(400))).toBe(100);
    // rounds up — a partial token still costs a token
    expect(estimateInputTokens("abc")).toBe(1);
  });

  it("sums multiple parts (userText + systemPrompt)", () => {
    expect(estimateInputTokens("a".repeat(40), "b".repeat(40))).toBe(20);
  });

  it("ignores null/undefined parts", () => {
    expect(estimateInputTokens("a".repeat(40), undefined, null)).toBe(10);
    expect(estimateInputTokens(undefined, null)).toBe(0);
    expect(estimateInputTokens("")).toBe(0);
  });

  it("scales with a large prompt (the abuse case) — a 200k-char prompt is ~50k tokens, not the blind default", () => {
    // Before ENG-1487 a text call reserved maxOutputTokens*4 regardless of
    // this; now the reservation tracks the real prompt size.
    expect(estimateInputTokens("x".repeat(200_000))).toBe(50_000);
  });
});
