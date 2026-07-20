/**
 * @vitest-environment node
 *
 * ENG-1570 — "public bot contact page" promised in Terms/Help
 * (`https://getsloe.com/bot`) didn't resolve anywhere in the repo. Pins:
 *
 *   1. The page exists, is reachable without auth, and carries the exact
 *      production UA string, an honest (non-overclaiming) "how to block it"
 *      section, and a real contact channel.
 *   2. `/terms` and `/help` actually link to it (the promise now points
 *      somewhere real).
 *   3. The UA `+URL` is canonical (`getsloe.com/bot`) everywhere it's sent,
 *      including the two call sites that previously drifted to the dead
 *      `suppr-club.com/bot` domain.
 *   4. `robots.txt` exists and documents the SupprBot identity without
 *      claiming any crawl restriction that isn't real.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

const CANONICAL_UA = "SupprBot/1.0 (+https://getsloe.com/bot)";

describe("ENG-1570 — /bot page exists and is honest", () => {
  const botPage = read("app/bot/page.tsx");

  it("carries the exact production UA string", () => {
    expect(botPage).toContain(CANONICAL_UA);
  });

  it("documents the SupprBot token and a contact channel", () => {
    expect(botPage).toContain("SupprBot");
    expect(botPage).toContain("legal@getsloe.com");
  });

  it("gives a working block mechanism (User-Agent matching)", () => {
    expect(botPage.toLowerCase()).toContain("user-agent");
    expect(botPage.toLowerCase()).toContain("block");
  });

  // The bot does not actually parse robots.txt anywhere in the fetch
  // pipeline (no robots-parsing dependency/code exists in
  // app/api/recipe-import/route.ts or src/lib/recipe-import/). Claiming we
  // honour a robots.txt Disallow rule would be a new false legal claim —
  // exactly the failure mode this ticket exists to fix. This pins the page
  // to the honest claim instead.
  it("does not falsely claim SupprBot parses/honours robots.txt", () => {
    const false_claims = [
      "we honour your robots.txt",
      "we honor your robots.txt",
      "we respect robots.txt",
      "we follow robots.txt",
      "we check robots.txt",
    ];
    const lower = botPage.toLowerCase();
    for (const claim of false_claims) {
      expect(lower).not.toContain(claim);
    }
    // ...but says so honestly, and still gives a real path to being blocked.
    expect(lower).toContain("robots.txt");
    expect(lower).toContain("do not yet");
  });

  it("is a public route (no auth gate on the promised page)", () => {
    const middleware = read("middleware.ts");
    const publicRoutesBlock = middleware.slice(
      middleware.indexOf("PUBLIC_ROUTES = new Set(["),
      middleware.indexOf("]);"),
    );
    expect(publicRoutesBlock).toMatch(/"\/bot"/);
  });
});

describe("ENG-1570 — Terms/Help link to the real page", () => {
  it("app/terms/page.tsx links the promise to /bot", () => {
    const terms = read("app/terms/page.tsx");
    expect(terms).toContain("SupprBot");
    expect(terms).toMatch(/href="\/bot"/);
  });

  it("app/help/HelpClient.tsx links the promise to /bot", () => {
    const help = read("app/help/HelpClient.tsx");
    expect(help).toContain("SupprBot");
    expect(help).toMatch(/href="\/bot"/);
  });
});

describe("ENG-1570 — UA +URL is canonical (getsloe.com/bot) everywhere", () => {
  const sites: Array<[label: string, relPath: string]> = [
    ["app/api/recipe-import/route.ts", "app/api/recipe-import/route.ts"],
    ["src/lib/recipe-import/extractSocialRecipe.ts", "src/lib/recipe-import/extractSocialRecipe.ts"],
    ["scripts/seed-discover-recipes.ts", "scripts/seed-discover-recipes.ts"],
    ["tests/integration/recipeImportLiveSites.test.ts", "tests/integration/recipeImportLiveSites.test.ts"],
  ];

  for (const [label, relPath] of sites) {
    it(`${label} sends the canonical UA and never the legacy suppr-club.com/bot`, () => {
      const src = read(relPath);
      expect(src).toContain(CANONICAL_UA);
      expect(src).not.toContain("suppr-club.com/bot");
    });
  }
});

describe("ENG-1570 — robots.txt documents SupprBot honestly", () => {
  const robots = read("public/robots.txt");

  it("mentions SupprBot and points to the real page", () => {
    expect(robots).toContain("SupprBot");
    expect(robots).toContain("https://getsloe.com/bot");
  });

  it("doesn't disallow the whole site (this file is documentation, not a new crawl restriction)", () => {
    expect(robots).toMatch(/User-agent:\s*\*/);
    expect(robots).toMatch(/Allow:\s*\//);
    expect(robots).not.toMatch(/Disallow:\s*\/\s*$/m);
  });
});
