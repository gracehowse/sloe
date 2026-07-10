import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ENG-716 — the two 404 / not-found pages used to diverge wildly: the generic
 * `app/not-found.tsx` was a slate-littered card shell, while the recipe
 * `app/recipe/[id]/not-found.tsx` shipped a slate-50 ground, a gradient-circle
 * 🍽️ emoji, and a violet→indigo gradient CTA. This sweep unifies them onto one
 * tokenised visual language (shared card shell, lucide icon in a tokenised
 * circle, semantic tokens, primary/outline CTA pair) and removes the off-token
 * literals. Source-assertion style so the unification can't silently regress.
 */
const read = (rel: string) => readFileSync(resolve(__dirname, rel), "utf8");

/** Strip `//` line + block comments so negative literal-assertions test the
 *  actual CODE — the doc-comments legitimately describe the old divergent
 *  treatment (emoji / gradient / cool-grey ground) they replaced. */
function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const GENERIC = "../../app/not-found.tsx";
const RECIPE = "../../app/recipe/[id]/not-found.tsx";

describe("ENG-716 — 404 pages tokenised + unified", () => {
  for (const [name, rel] of [
    ["generic 404", GENERIC],
    ["recipe 404", RECIPE],
  ] as const) {
    describe(name, () => {
      const src = () => read(rel);

      it("uses semantic surface/ink tokens (no slate/violet/indigo palette literals)", () => {
        const s = src();
        expect(s).toMatch(/bg-background/);
        expect(s).toMatch(/bg-card/);
        // Hairline via the shared `.card-slab` shell (ENG-1500 — the flat
        // card grammar), not a bespoke border class.
        expect(s).toMatch(/card-slab/);
        expect(s).toMatch(/text-muted-foreground/);
        expect(s).toMatch(/text-foreground/);
        const code = codeOnly(s);
        expect(code).not.toMatch(/slate-\d/);
        expect(code).not.toMatch(/violet-\d/);
        expect(code).not.toMatch(/indigo-\d/);
        // No literal hex colours.
        expect(code).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      });

      it("renders a lucide icon in a tokenised circle, not an emoji", () => {
        const s = src();
        expect(s).toMatch(/from "lucide-react"/);
        expect(s).toMatch(/rounded-full bg-muted/);
        // The plate emoji glyph is gone from the rendered markup (code only).
        expect(codeOnly(s)).not.toMatch(/🍽️/);
      });

      it("shares the unified card shell + primary/outline Button CTA pair", () => {
        const s = src();
        expect(s).toMatch(/from "@\/app\/components\/ui\/button"/);
        // One card grammar (ENG-1500): 24px corner + flat `.card-slab`
        // (hairline, no resting shadow) — the soft lift is retired here.
        expect(s).toMatch(/rounded-card-lg bg-card card-slab/);
        expect(s).not.toMatch(/shadow-\[var\(--elev-card-soft\)\]/);
        expect(s).toMatch(/<Button asChild>/);
        expect(s).toMatch(/variant="outline"/);
        // No bespoke gradient CTA.
        expect(codeOnly(s)).not.toMatch(/bg-gradient-to-/);
      });
    });
  }

  it("recipe 404 keeps its recipe-aware copy + in-product CTA destinations", () => {
    const s = read(RECIPE);
    expect(s).toMatch(/Recipe not found/);
    expect(s).toMatch(/UtensilsCrossed/);
    expect(s).toMatch(/href="\/discover"/);
    expect(s).toMatch(/href="\/today"/);
  });
});
