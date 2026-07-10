/**
 * Web skeleton token visibility gate (ENG-1486).
 *
 * Web mirror of apps/mobile skeletonTokenContrast.test.ts (ENG-1479):
 * `--skeleton` must keep a measured luminance separation from `--card`
 * in BOTH schemes. Third occurrence of the "token reuse silently blanks
 * a loading/empty surface" class (ENG-1477 ring, ENG-1479 mobile
 * skeletons) — the dark `--muted` this replaced measured 1.03:1 on the
 * dark card. Parses theme.css directly so the gate tracks the shipped
 * values, not a copy.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "../../src/styles/theme.css"), "utf8");

/** Extract a `--token: #HEX` value from a scheme block ("light" = :root, "dark" = .dark). */
function tokenHex(scheme: "light" | "dark", token: string): string {
  // Split on the dark-scheme selector; light tokens live before it.
  const darkStart = css.search(/\.dark\s*\{|\[data-theme="dark"\]|@media \(prefers-color-scheme: dark\)/);
  expect(darkStart).toBeGreaterThan(0);
  const section = scheme === "light" ? css.slice(0, darkStart) : css.slice(darkStart);
  const m = new RegExp(`--${token}:\\s*(#[0-9a-fA-F]{6})`).exec(section);
  expect(m, `--${token} (${scheme}) must be a literal hex`).toBeTruthy();
  return m![1];
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

describe("--skeleton — visible against the --card it loads inside (ENG-1486)", () => {
  it("light: skeleton vs card clears the 1.15:1 floor", () => {
    expect(contrast(tokenHex("light", "skeleton"), tokenHex("light", "card"))).toBeGreaterThanOrEqual(1.15);
  });

  it("dark: skeleton vs card clears the 1.15:1 floor", () => {
    expect(contrast(tokenHex("dark", "skeleton"), tokenHex("dark", "card"))).toBeGreaterThanOrEqual(1.15);
  });

  it("skeleton fills use the dedicated token, not bg-muted", () => {
    const shimmer = readFileSync(
      resolve(__dirname, "../../src/app/components/ui/skeleton-row.tsx"),
      "utf8",
    );
    expect(shimmer).toMatch(/animate-pulse bg-skeleton/);
    expect(shimmer).not.toMatch(/animate-pulse bg-muted/);
  });
});
