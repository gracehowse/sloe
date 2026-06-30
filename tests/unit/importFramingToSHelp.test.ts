/**
 * @vitest-environment node
 *
 * ENG-860 — user-as-actor / private-by-default import framing in the web
 * Terms of Service + Help. The legal-approved wording lives in
 * docs/decisions/2026-06-03-recipe-import-posture-part1-part2.md
 * ("Exact wording" § → "ToS / Help (user-as-actor + honest fetcher)").
 *
 * These pages are the single canonical ToS/Help surface for BOTH platforms —
 * mobile Settings + login fine-print open the web /terms + /help via
 * Linking.openURL (no native mobile screen). So pinning the web copy pins it
 * for mobile too.
 *
 * Two jobs:
 *  1. Pin the five locked claims (personal copy / user-initiated / private by
 *     default / facts-only + link-back / honest identified fetcher) so a future
 *     edit either keeps the legally-required framing or surfaces the change here
 *     for the legal lens to re-approve.
 *  2. HARD CONSTRAINT: assert the "no bots" denial stays ABSENT. The web/blog
 *     import path runs an honest, identified, rate-limited fetcher
 *     (SupprBot/1.0, extractSocialRecipe.ts) — claiming "no bots" / "we never
 *     use bots" would be false and is the weaker posture. The honest framing is
 *     both true and stronger; this test fails if anyone reintroduces a denial.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");
const TERMS_PATH = path.join(ROOT, "app", "terms", "page.tsx");
const HELP_PATH = path.join(ROOT, "app", "help", "HelpClient.tsx");

/** Collapse JSX whitespace + decode the entity escapes the pages use so phrase
 *  matching doesn't depend on hard-wrapping or HTML-entity apostrophes. */
function flatten(source: string): string {
  return source
    .replace(/&rsquo;/g, "'")
    .replace(/&mdash;/g, "—")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/\s+/g, " ");
}

const termsRaw = readFileSync(TERMS_PATH, "utf8");
const helpRaw = readFileSync(HELP_PATH, "utf8");
const terms = flatten(termsRaw);
const help = flatten(helpRaw);

// The five locked claims, phrase-level (light-handed — not byte-for-byte, so a
// trivial rewrap doesn't fail; a meaning change does).
const LOCKED_CLAIMS = [
  // 1. user-initiated personal copy
  "Sloe makes a personal copy in your own cookbook",
  // 2. always started by the user, never automatic
  "Imports are always started by you, never automatic",
  // 3. private by default
  "private by default",
  // 4. facts-only + link back; no prose/photos; no bulk-scraping
  "we capture the facts",
  "link back to the original",
  "we don't copy the original article's writing or photos",
  "we don't bulk-collect recipes",
  // 5. honest, identified fetcher (NOT "no bots")
  "we identify ourselves honestly as Sloe's importer",
];

// Phrases that would constitute a false "no bots" denial — must never appear.
const FORBIDDEN_DENIALS = [
  "no bots",
  "never use bots",
  "we never use bots",
  "we don't use bots",
  "without bots",
  "no automated fetcher",
  "no crawler",
];

describe("ENG-860 — Terms of service: import user-as-actor framing", () => {
  it("has an 'Importing recipes' section in the ToC and body", () => {
    expect(termsRaw).toContain('id: "importing-recipes"');
    expect(termsRaw).toContain('id="importing-recipes"');
    expect(terms).toContain("Importing recipes");
  });

  for (const claim of LOCKED_CLAIMS) {
    it(`pins the locked claim: "${claim}"`, () => {
      expect(terms.toLowerCase()).toContain(claim.toLowerCase());
    });
  }

  it("keeps the honest SupprBot fetcher framing (acceptable-use section already had it)", () => {
    expect(termsRaw).toContain("SupprBot");
    expect(terms).toContain("identified");
  });

  for (const denial of FORBIDDEN_DENIALS) {
    it(`never claims the false denial: "${denial}"`, () => {
      expect(terms.toLowerCase()).not.toContain(denial);
    });
  }
});

describe("ENG-860 — Help: import user-as-actor framing", () => {
  it("has a 'How recipe import works' section", () => {
    expect(helpRaw).toContain('id: "importing-recipes"');
    expect(help).toContain("How recipe import works");
  });

  for (const claim of LOCKED_CLAIMS) {
    it(`pins the locked claim: "${claim}"`, () => {
      expect(help.toLowerCase()).toContain(claim.toLowerCase());
    });
  }

  it("frames the bot honestly: identified + rate-limited + facts-only, links to ToS", () => {
    expect(helpRaw).toContain("SupprBot");
    expect(help).toContain("identified");
    expect(help).toContain("rate-limited");
    expect(helpRaw).toMatch(/href="\/terms"/);
  });

  it("section is discoverable by the help search (import facts in the search blob)", () => {
    // The search filter matches title + searchBlob; the new section must carry
    // import-related terms so a user searching "import" finds it.
    const blobMatch = helpRaw.match(
      /id: "importing-recipes"[\s\S]*?searchBlob:\s*"([^"]+)"/,
    );
    expect(blobMatch, "importing-recipes searchBlob present").not.toBeNull();
    const blob = blobMatch?.[1] ?? "";
    expect(blob).toContain("import");
    expect(blob).toContain("private");
    expect(blob).toContain("supprbot");
  });

  for (const denial of FORBIDDEN_DENIALS) {
    it(`never claims the false denial: "${denial}"`, () => {
      expect(help.toLowerCase()).not.toContain(denial);
    });
  }
});
