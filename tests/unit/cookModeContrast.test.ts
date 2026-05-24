/**
 * CookMode — step text must use foreground tokens on bg-background
 * (2026-05-21). White copy on the light cream background was invisible.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const COOK = readFileSync(
  resolve(__dirname, "../../src/app/components/CookMode.tsx"),
  "utf8",
);
const MOBILE_COOK = readFileSync(
  resolve(__dirname, "../../apps/mobile/app/cook.tsx"),
  "utf8",
);

describe("Cook mode readable text", () => {
  it("web step instructions use text-foreground, not text-white on bg-background", () => {
    expect(COOK).toMatch(/bg-background text-foreground/);
    expect(COOK).toMatch(/leading-relaxed text-foreground/);
    expect(COOK).not.toMatch(/leading-relaxed text-white/);
    expect(COOK).not.toMatch(/bg-background text-white/);
  });

  it("mobile cook step text uses theme colors.text", () => {
    expect(MOBILE_COOK).toMatch(/stepText:[\s\S]*?color: colors\.text/);
  });
});
