/**
 * @vitest-environment node
 *
 * Launch gate smoke — real recipe URLs (ENG-1055 / ENG-670).
 * Skipped unless RUN_LIVE_IMPORT_SMOKE=1 (needs network + optional SUPADATA_KEY).
 *
 *   RUN_LIVE_IMPORT_SMOKE=1 npm test -- --run tests/integration/recipeImportLiveSites.test.ts
 */
import { describe, it, expect } from "vitest";
import { followWithSsrfGuard } from "@/lib/recipe-import/ssrfGuard";
import { parseRecipeFromHtml } from "@/lib/recipe-import/parseRecipeFromHtml";

const LIVE = process.env.RUN_LIVE_IMPORT_SMOKE === "1";
const SITES = [
  {
    name: "budgetbytes",
    url: "https://www.budgetbytes.com/creamy-garlic-chicken/",
  },
  {
    name: "allrecipes",
    url: "https://www.allrecipes.com/recipe/23600/worlds-best-lasagna/",
  },
] as const;

const describeLive = LIVE ? describe : describe.skip;

describeLive("live recipe URL smoke (ENG-1055)", () => {
  for (const site of SITES) {
    it(`${site.name} — SupprBot fetch yields JSON-LD or documents block status`, async () => {
      const fetched = await followWithSsrfGuard(site.url, {
        headers: {
          Accept: "text/html",
          // ENG-1570 — canonical UA +URL, matching production
          // (app/api/recipe-import/route.ts, extractSocialRecipe.ts).
          "User-Agent": "SupprBot/1.0 (+https://getsloe.com/bot)",
        },
      });
      expect(fetched, "SSRF guard blocked URL").not.toBeNull();
      const { res } = fetched!;
      const html = await res.text();
      const parsed = parseRecipeFromHtml(html);
      if (parsed?.ingredients?.length) {
        expect(parsed.title).toBeTruthy();
        expect(parsed.ingredients.length).toBeGreaterThan(0);
      } else {
        // Document bot-wall status — prod must use Supadata fallback for these.
        expect([402, 403, 429]).toContain(res.status);
      }
    }, 30_000);
  }
});
