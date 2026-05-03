/**
 * Hex literals → theme tokens — lock-in regression (2026-05-02).
 *
 * Pins the 2026-05-02 sweep that replaced raw destructive
 * (`#EF4444` / `#B91C1C`), warning (`#F59E0B` / `#B45309`), and
 * primary-foreground (`#fff` / `#FFFFFF`) hex literals with the
 * canonical `Accent.destructive`, `Accent.warning`, and
 * `colors.primaryForeground` tokens across:
 *
 *   - `apps/mobile/components/Badge.tsx`
 *   - `apps/mobile/components/VoiceLogSheet.tsx`
 *   - `apps/mobile/components/PhotoLogSheet.tsx`
 *   - `apps/mobile/components/today/TodayDateHeader.tsx`
 *   - `apps/mobile/app/recipe/[id].tsx`
 *
 * Documented anchor exceptions (must NOT be flagged):
 *   - `Badge.tsx` — `#94a3b8` slate-400 neutral variant anchor
 *   - `Badge.tsx` — `#8b5cf6` AI violet variant anchor
 *   - `#00000066` — modal overlay tint shared with web
 *
 * The test reads each file's source and asserts no banned hex
 * appears in actual code (string/JSX context). Doc-comment mentions
 * are stripped before matching so prose like `// avoid hardcoding
 * \`#fff\`` doesn't trip the gate.
 *
 * If a future change re-introduces a raw `#EF4444` / `#B91C1C` /
 * `#F59E0B` / `#B45309` / `#fff` outside the documented anchors,
 * this test fails — push them through `Accent.*` /
 * `colors.primaryForeground` instead.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const FILES_TO_GUARD = [
  "../../components/Badge.tsx",
  "../../components/VoiceLogSheet.tsx",
  "../../components/PhotoLogSheet.tsx",
  "../../components/today/TodayDateHeader.tsx",
  "../../app/recipe/[id].tsx",
] as const;

const BANNED_HEX_RE =
  /#(?:EF4444|B91C1C|F59E0B|B45309|fff(?![0-9a-fA-F])|FFFFFF(?![0-9a-fA-F]))/g;

/**
 * Strip line comments (`// …`) and block comments (`/* … *\/`) from
 * source so prose hex mentions in JSDoc / inline notes are never
 * counted as violations. JSX text / string literals stay intact.
 */
function stripComments(src: string): string {
  // Block comments first (multiline, non-greedy).
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, "");
  // Then line comments — strip everything from `//` to end-of-line.
  return noBlock.replace(/\/\/[^\n]*/g, "");
}

describe("hex token sweep — destructive / warning / primary-foreground (2026-05-02)", () => {
  for (const rel of FILES_TO_GUARD) {
    it(`${rel} contains no banned destructive/warning/primaryForeground hex literals`, () => {
      const fullPath = resolve(__dirname, rel);
      const src = readFileSync(fullPath, "utf8");
      const codeOnly = stripComments(src);
      const matches = codeOnly.match(BANNED_HEX_RE) ?? [];
      expect(matches).toEqual([]);
    });
  }

  it("Badge.tsx still anchors the documented exception hexes (#94a3b8 + #8b5cf6)", () => {
    const fullPath = resolve(__dirname, "../../components/Badge.tsx");
    const src = readFileSync(fullPath, "utf8");
    // These are intentional anchors — slate-400 neutral + AI violet.
    expect(src).toMatch(/#94a3b8/);
    expect(src).toMatch(/#8b5cf6/);
  });

  it("modal overlay tint #00000066 stays shared between VoiceLogSheet and PhotoLogSheet", () => {
    // Documented anchor — kept identical to the web modal overlay.
    const voice = readFileSync(
      resolve(__dirname, "../../components/VoiceLogSheet.tsx"),
      "utf8",
    );
    const photo = readFileSync(
      resolve(__dirname, "../../components/PhotoLogSheet.tsx"),
      "utf8",
    );
    expect(voice).toMatch(/#00000066/);
    expect(photo).toMatch(/#00000066/);
  });
});
