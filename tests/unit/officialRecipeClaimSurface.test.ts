/**
 * @vitest-environment node
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("ENG-1235 official recipe claim surfaces", () => {
  const web = read("src/app/components/RecipeDetail.tsx");
  const mobile = read("apps/mobile/app/recipe/[id].tsx");
  const route = read("app/api/recipes/claim-official/route.ts");

  it("gates both web and mobile owner actions behind the same flag", () => {
    for (const src of [web, mobile]) {
      expect(src).toContain("OFFICIAL_RECIPE_CLAIM_FLAG");
      expect(src).toContain("officialMacrosClaimBlocker");
      expect(src).toContain("Mark macros official");
      expect(src).toContain("/api/recipes/claim-official");
    }
  });

  it("keeps the server route on service-role ownership checks, not body user ids", () => {
    expect(route).toContain("getUserIdFromRequest(req)");
    expect(route).toContain("createSupabaseServiceRoleClient()");
    expect(route).toContain("row.author_id !== userId");
    expect(route).not.toMatch(/body\.(userId|authorId|claimedBy|claimed_by)/);
  });
});
