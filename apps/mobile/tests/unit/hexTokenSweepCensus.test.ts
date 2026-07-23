/**
 * ENG-1013 — raw-hex → semantic-token sweep census (source-grep gate).
 *
 * The sister of `hexTokenSweep.test.ts` (which pins a fixed 2026-05-02 set of
 * files against a fixed banned-hex list). This test takes the OPPOSITE shape:
 * it walks the ENTIRE ENG-1013 target screen tree and asserts that ZERO raw
 * hex colour literals remain anywhere in code (comments stripped first). It is
 * the test-layer twin of the `apps/mobile/eslint.config.js` raw-hex
 * `no-restricted-syntax` guard (the ENG-811 mobile lane): lint catches a new
 * hex at write time on a per-file basis; this catches the whole tree at once
 * and fails loudly if a future change reintroduces ANY raw hex on these
 * surfaces. A render-identical token-routing refactor must keep this green —
 * if a snapshot colour changed, the mapping was wrong, not this gate.
 *
 * Target tree (the four census-named tabs + Today component tree + recipe
 * detail — re-censused against the current v3 reskin file layout, 2026-06-29):
 *   - apps/mobile/app/(tabs)/*.tsx          (all tab screens)
 *   - apps/mobile/components/today/*.tsx     (Today component tree)
 *   - apps/mobile/app/recipe/[id].tsx        (recipe detail / cook-mode shell)
 *
 * Allowlist (NOT scanned — literal hexes are correct there):
 *   - apps/mobile/constants/theme.ts         — the token definitions; the only
 *                                              legal home for a literal hex.
 *   - app/login.tsx + onboarding signup.tsx  — Apple-HIG #000/#fff brand
 *                                              carve-out (not in target tree).
 *
 * A raw hex is `#` + 3/4/6/8 hex digits as a whole string (anchored), matching
 * the eslint selector + the web `SUPPR_RAW_COLOUR_SYNTAX` guard. Comments are
 * stripped before matching so prose hex mentions (e.g. `// was #5B3B6E`) never
 * trip the gate.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { Accent, ShadowColor } from "../../constants/theme";

const MOBILE_ROOT = resolve(__dirname, "../..");

/** Directories whose top-level `.tsx` files are scanned (non-recursive). */
const SCAN_DIRS = [
  "app/(tabs)",
  "components/today",
] as const;

/** Individually-named target files outside the scanned dirs. */
const SCAN_FILES = ["app/recipe/[id].tsx"] as const;

/**
 * Strip line + block comments so prose hex mentions in JSDoc / inline notes
 * are never counted. JSX text / string literals stay intact. (Shared shape
 * with `hexTokenSweep.test.ts`.)
 */
function stripComments(src: string): string {
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, "");
  return noBlock.replace(/\/\/[^\n]*/g, "");
}

/** Anchored raw-hex colour literal — mirrors the eslint selector exactly. */
const RAW_HEX_RE =
  /["'`]#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})["'`]/g;

function collectTargetTsx(): string[] {
  const files: string[] = [];
  for (const dir of SCAN_DIRS) {
    const abs = join(MOBILE_ROOT, dir);
    for (const entry of readdirSync(abs)) {
      // Storybook canvases are not product UI — they may use page-ground hexes
      // for RN-web framing. Product `.tsx` files remain zero-hex.
      if (!entry.endsWith(".tsx") || entry.endsWith(".stories.tsx")) continue;
      files.push(join(dir, entry));
    }
  }
  for (const f of SCAN_FILES) files.push(f);
  return files.sort();
}

describe("ENG-1013 hex sweep census — zero raw hexes in the target screen tree", () => {
  const targets = collectTargetTsx();

  it("discovers a non-trivial target set (guards against a broken glob)", () => {
    // The Today component tree alone is 50+ files; if this collapses to a
    // handful the scan globs silently broke and the gate would pass blind.
    expect(targets.length).toBeGreaterThan(40);
  });

  for (const rel of targets) {
    it(`${rel} has no raw hex colour literal`, () => {
      const src = readFileSync(join(MOBILE_ROOT, rel), "utf8");
      const codeOnly = stripComments(src);
      const matches = codeOnly.match(RAW_HEX_RE) ?? [];
      // Surface the offending literals in the failure message.
      expect(matches, `raw hex literal(s) in ${rel}: ${matches.join(", ")}`).toEqual(
        [],
      );
    });
  }

  it("the whole target tree is clean in aggregate", () => {
    const offenders: Record<string, string[]> = {};
    for (const rel of targets) {
      const src = stripComments(readFileSync(join(MOBILE_ROOT, rel), "utf8"));
      const matches = src.match(RAW_HEX_RE) ?? [];
      if (matches.length) offenders[rel] = matches;
    }
    expect(offenders).toEqual({});
  });
});

describe("ENG-1013 tokens the sweep routed through", () => {
  it("Accent.frostBright pins the cook-mode shell primary-text value (#efe9f2)", () => {
    // The recipe/[id].tsx + cook.tsx cook overlays read their headline in this
    // value over the deep-plum brand ground. A drift here would silently
    // recolour cook mode.
    expect(Accent.frostBright).toBe("#efe9f2");
  });

  it("ShadowColor.cast pins the neutral black shadow base (#000)", () => {
    // The bespoke toast / sheet / modal shadows route their shadowColor here;
    // value must equal the literal they replaced so every shadow renders the
    // same.
    expect(ShadowColor.cast).toBe("#000");
  });

  it("ShadowColor.ink pins the aubergine card-shadow base (#221B26)", () => {
    expect(ShadowColor.ink).toBe("#221B26");
  });
});
