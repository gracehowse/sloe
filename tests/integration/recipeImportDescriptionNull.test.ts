/**
 * @vitest-environment node
 *
 * ENG-857 (P0, legal) — the web/blog recipe-import path must NOT return the
 * creator's verbatim JSON-LD `description` headnote (protected creative prose).
 * It is nulled at the route boundary; the macro-sanity check (`captionNutrition`)
 * still reads the prose server-side, so any per-serving claim in the headnote is
 * still surfaced for the verify screen WITHOUT the prose leaving the server.
 *
 * No live calls: fetch is stubbed (`vi.stubGlobal`), nutrition providers are
 * disabled, the user + rate-limit + feature-flag layers are mocked.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/supabase/serverAnonClient", () => ({
  getUserIdFromRequest: vi.fn(async () => "user-123"),
}));

vi.mock("@/lib/server/rateLimit", () => ({
  rateLimit: vi.fn(async () => ({ ok: true, retryAfterSec: 0 })),
}));

vi.mock("@/lib/server/serverEnv", () => ({
  hasUsdaConfig: () => false,
  hasFatSecretConfig: () => false,
  hasEdamamConfig: () => false,
  hasSupabaseServiceConfig: () => false,
}));

const flagState: Record<string, boolean> = {};
vi.mock("@/lib/server/featureFlags", () => ({
  isServerFeatureEnabled: vi.fn(async (flag: string) => flagState[flag] ?? false),
}));

import { POST } from "../../app/api/recipe-import/route";

/** The creator's verbatim headnote — the prose we must NOT reproduce. */
const CREATOR_HEADNOTE =
  "This is my grandmother's secret recipe, lovingly passed down through four generations of bakers in Tuscany.";

const JSON_LD_WITH_DESCRIPTION = `<html><head><script type="application/ld+json">${JSON.stringify(
  {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: "Tuscan Lemon Cake",
    description: CREATOR_HEADNOTE,
    recipeIngredient: ["200g flour", "2 eggs", "100g sugar"],
    recipeInstructions: ["Mix the dry", "Fold the wet", "Bake at 180C"],
    recipeYield: "8",
  },
)}</script></head><body>Cake</body></html>`;

function makeReq(url: string): Request {
  return new Request("http://localhost/api/recipe-import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
}

/** Live-fetch stub that serves the JSON-LD HTML for the page URL. */
function htmlFetch(html: string) {
  return vi.fn(async () => ({
    status: 200,
    ok: true,
    headers: { get: (k: string) => (k.toLowerCase() === "content-type" ? "text/html" : null) },
    text: async () => html,
  }));
}

describe("POST /api/recipe-import — ENG-857 web/blog description is nulled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(flagState)) delete flagState[k];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns recipe.description === null for a web URL with a JSON-LD description", async () => {
    vi.stubGlobal("fetch", htmlFetch(JSON_LD_WITH_DESCRIPTION) as unknown as typeof fetch);

    const res = await POST(makeReq("https://smittenkitchen.com/tuscan-lemon-cake"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    // The FACTS are kept.
    expect(body.recipe.title).toBe("Tuscan Lemon Cake");
    expect(body.recipe.ingredients).toEqual(["200g flour", "2 eggs", "100g sugar"]);
    // The PROSE is gone — null, and the verbatim headnote appears nowhere.
    expect(body.recipe.description).toBeNull();
    expect(JSON.stringify(body.recipe)).not.toContain("grandmother");
    expect(JSON.stringify(body.recipe)).not.toContain(CREATOR_HEADNOTE);
  });

  it("still attributes + links back to the source (facts + attribution kept)", async () => {
    vi.stubGlobal("fetch", htmlFetch(JSON_LD_WITH_DESCRIPTION) as unknown as typeof fetch);

    const res = await POST(makeReq("https://smittenkitchen.com/tuscan-lemon-cake"));
    const body = await res.json();

    expect(body.recipe.sourceUrl).toBe("https://smittenkitchen.com/tuscan-lemon-cake");
    expect(typeof body.recipe.sourceName).toBe("string");
    expect(body.recipe.sourceName.length).toBeGreaterThan(0);
  });

  it("keeps the description as macro-sanity input (captionNutrition still computed)", async () => {
    // A headnote that states a per-serving calorie claim must still be read for
    // the macro-sanity comparison — proving the description prose is consumed
    // server-side even though it never appears in the persisted/rendered field.
    const html = `<html><head><script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Recipe",
      name: "Protein Pancakes",
      description: "A light breakfast — about 320 calories and 28g protein per serving. Family favourite.",
      recipeIngredient: ["100g oats", "2 eggs"],
      recipeInstructions: ["Blend", "Cook"],
      recipeYield: "2",
    })}</script></head><body>Pancakes</body></html>`;
    vi.stubGlobal("fetch", htmlFetch(html) as unknown as typeof fetch);

    const res = await POST(makeReq("https://example.com/protein-pancakes"));
    const body = await res.json();

    expect(body.recipe.description).toBeNull();
    // The macro claim from the headnote was extracted (proves the prose was
    // read for the sanity check) — without surfacing the prose itself.
    expect(body.recipe.captionNutrition).toBeTruthy();
    expect(body.recipe.captionNutrition.caloriesPerServing).toBe(320);
    expect(body.recipe.captionNutrition.proteinG).toBe(28);
    // And the prose ("Family favourite") is still absent from the payload.
    expect(JSON.stringify(body.recipe)).not.toContain("Family favourite");
  });
});
