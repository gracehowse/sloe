import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Lock-in regression test — fails if `@expo/vector-icons` re-appears in
 * the four mobile surfaces that ui-critic finding #3 swept to lucide.
 * Replaces stale PR #32; rebuilt on current main per PR-staleness-prevention
 * sweep on 2026-05-02.
 *
 * ENG-120 (2026-07-02) — the long-tail sweep migrated the remaining ~35
 * production files off Ionicons. The `SWEPT_FILES` allowlist below no longer
 * scales, so the durable guard is the class-level scan further down: NO
 * production file may import `@expo/vector-icons` EXCEPT the four brand
 * carve-outs (lucide removed all brand glyphs, so `logo-apple` /
 * `logo-instagram` / `logo-tiktok` have no lucide equivalent and must NOT be
 * approximated — see feedback_prototype_icons_exact).
 */

const SWEPT_FILES = [
  "components/VoiceLogSheet.tsx",
  "components/PhotoLogSheet.tsx",
  "components/QuickAddPanel.tsx",
  "components/charts/DayStrip.tsx",
] as const;

// ENG-120 — the ONLY production files allowed to keep an `@expo/vector-icons`
// import, and only for brand `logo-*` glyphs lucide doesn't ship.
const BRAND_CARVE_OUTS = new Set<string>([
  // ENG-1565: Apple logo glyph moved out of login.tsx into the pressable extract.
  "components/login/LoginScreenPressables.tsx",
  "app/import-shared.tsx",
  "components/onboarding/steps/signup.tsx",
]);

const MOBILE_ROOT = resolve(__dirname, "../..");
const IONICONS_IMPORT = /from\s+["']@expo\/vector-icons["']/;

function walkTsx(relDir: string): string[] {
  const abs = resolve(MOBILE_ROOT, relDir);
  const out: string[] = [];
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    const rel = `${relDir}/${entry.name}`;
    if (entry.isDirectory()) {
      out.push(...walkTsx(rel));
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(rel);
    }
  }
  return out;
}

describe("icon language: no Ionicons in swept files (PR #32 lock-in)", () => {
  for (const path of SWEPT_FILES) {
    it(`apps/mobile/${path} does not import Ionicons / @expo/vector-icons`, () => {
      const src = readFileSync(resolve(__dirname, "../..", path), "utf8");
      expect(src).not.toMatch(/from\s+["']@expo\/vector-icons["']/);
      expect(src).not.toMatch(/\bIonicons\b/);
    });
  }

  it("all four files import from lucide-react-native instead", () => {
    for (const path of SWEPT_FILES) {
      const src = readFileSync(resolve(__dirname, "../..", path), "utf8");
      expect(src, `${path} should import from lucide-react-native`).toMatch(
        /from\s+["']lucide-react-native["']/,
      );
    }
  });
});

describe("ENG-120: @expo/vector-icons survives only in brand carve-outs", () => {
  const prodFiles = [...walkTsx("app"), ...walkTsx("components")];
  const importers = prodFiles.filter((f) => IONICONS_IMPORT.test(readFileSync(resolve(MOBILE_ROOT, f), "utf8")));

  it("no production file imports @expo/vector-icons except the four brand carve-outs", () => {
    const unexpected = importers.filter((f) => !BRAND_CARVE_OUTS.has(f));
    expect(
      unexpected,
      `these files still import @expo/vector-icons and must migrate to lucide-react-native: ${unexpected.join(", ")}`,
    ).toEqual([]);
  });

  it("every declared brand carve-out actually still imports Ionicons (else drop it from the allowlist)", () => {
    const stale = [...BRAND_CARVE_OUTS].filter((f) => !importers.includes(f));
    expect(stale, `these carve-outs no longer import Ionicons — remove from BRAND_CARVE_OUTS: ${stale.join(", ")}`).toEqual(
      [],
    );
  });

  for (const f of BRAND_CARVE_OUTS) {
    it(`${f} documents its ENG-120 brand-glyph carve-out and only uses logo-* Ionicons literals`, () => {
      const src = readFileSync(resolve(MOBILE_ROOT, f), "utf8");
      // Must carry the ENG-120 rationale comment so the retained import reads as intentional.
      expect(src, `${f} must document the ENG-120 brand-glyph carve-out`).toMatch(/ENG-120: lucide has no brand glyph/);
      // Any Ionicons glyph literal in the file must be a brand `logo-*` name.
      // (Robust: only checks names on an <Ionicons ... name="..."> tag, so
      // non-icon `name=` props elsewhere never trip it.)
      const ioniconNames = [...src.matchAll(/<Ionicons[^>]*?\bname=["']([^"']+)["']/g)].map((m) => m[1]);
      const nonBrand = ioniconNames.filter((n) => !n.startsWith("logo-"));
      expect(nonBrand, `${f} renders a non-brand Ionicons glyph that should be lucide: ${nonBrand.join(", ")}`).toEqual(
        [],
      );
    });
  }
});
