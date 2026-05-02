import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Hex-token sweep (ui-critic finding #2, P1).
 *
 * Four high-traffic surfaces — Badge, VoiceLogSheet, PhotoLogSheet,
 * recipe/[id] — used to mix raw hex literals next to `Accent.*` /
 * theme tokens. Mixing makes dark-mode contrast brittle (a `#fff`
 * burns through a dark surface that wanted `primaryForeground`) and
 * lets a future palette tweak silently miss four files.
 *
 * This test pins the file shape: no raw 6-digit hex literals in the
 * style props of these files. Two narrow exceptions are allowed:
 *   - `Badge.tsx` keeps `#94a3b8` (slate-400 — `neutral` variant
 *     anchor that intentionally does not derive from `Accent.*`) and
 *     `#8b5cf6` (`ai` variant violet — mirrors web `--chart-5` and is
 *     already documented as the AI tone in the file).
 *   - The shadow stylesheet entry in `recipe/[id].tsx` uses `#000` as
 *     the canonical RN `shadowColor` value, which is the platform
 *     contract.
 *
 * If a new colour is genuinely needed, add it to `Accent` /
 * `Colors.{light,dark}` in `apps/mobile/constants/theme.ts` first.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");

function read(relPath: string): string {
  return readFileSync(resolve(REPO_ROOT, relPath), "utf8");
}

/** All 6-digit `#XXXXXX` and 3-digit `#XXX` hex literals quoted as
 *  strings — the regex catches both `"#fff"` and `"#EF4444"` plus
 *  alpha-suffixed variants like `"#EF444466"`. */
const HEX_LITERAL_RE = /"#([0-9a-fA-F]{3,8})"/g;

function findHexLiterals(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(HEX_LITERAL_RE)) {
    out.push(m[0]);
  }
  return out;
}

describe("hex sweep — Badge / Voice / Photo / recipe route through theme tokens", () => {
  it("Badge.tsx — only the documented anchor exceptions remain", () => {
    const src = read("apps/mobile/components/Badge.tsx");
    const hexes = findHexLiterals(src);
    // `neutral` anchor (slate-400) + `ai` anchor (violet) are the two
    // documented exceptions. Both are inside the `variantColors`
    // mapping at the top of the file.
    expect(hexes.sort()).toEqual(['"#8b5cf6"', '"#94a3b8"']);
  });

  it("VoiceLogSheet.tsx — no raw hex literals in style/colour props", () => {
    const src = read("apps/mobile/components/VoiceLogSheet.tsx");
    const hexes = findHexLiterals(src);
    // The badge AI icon stays violet to match the Badge `ai` variant
    // anchor. Everything else is now token-driven.
    expect(hexes.sort()).toEqual(['"#00000066"', '"#8b5cf6"']);
    // The two destructive tones and the warning tones must be gone.
    expect(src).not.toMatch(/"#EF4444/);
    expect(src).not.toMatch(/"#B91C1C"/);
    expect(src).not.toMatch(/"#F59E0B/);
    expect(src).not.toMatch(/"#B45309"/);
    // `#fff` button labels must route via `colors.primaryForeground`.
    expect(src).not.toMatch(/"#fff"/);
  });

  it("PhotoLogSheet.tsx — no raw hex literals in style/colour props", () => {
    const src = read("apps/mobile/components/PhotoLogSheet.tsx");
    const hexes = findHexLiterals(src);
    expect(hexes.sort()).toEqual(['"#00000066"', '"#8b5cf6"']);
    expect(src).not.toMatch(/"#EF4444/);
    expect(src).not.toMatch(/"#B91C1C"/);
    expect(src).not.toMatch(/"#F59E0B/);
    expect(src).not.toMatch(/"#B45309"/);
    expect(src).not.toMatch(/"#fff"/);
  });

  it("recipe/[id].tsx — step number + action button text route through colors.primaryForeground", () => {
    const src = read("apps/mobile/app/recipe/[id].tsx");
    // The two specific lines flagged by the audit must use
    // `colors.primaryForeground`, not `"#fff"`.
    expect(src).toMatch(
      /stepNumberText:\s*\{\s*color:\s*colors\.primaryForeground\b/,
    );
    expect(src).toMatch(
      /actionBtnText:\s*\{\s*color:\s*colors\.primaryForeground\b/,
    );
  });

  it("TodayDateHeader.tsx — view-mode toggle icons route through theme primaryForeground", () => {
    const src = read("apps/mobile/components/today/TodayDateHeader.tsx");
    expect(src).toMatch(/themeColors\.primaryForeground/);
    // The two flagged inline `#fff` colour props are gone.
    const innerHexes = findHexLiterals(src);
    expect(innerHexes).not.toContain('"#fff"');
  });
});
