/**
 * Structural parity pin for the imported-recipe source card render gate.
 *
 * Context — TestFlight build 10 fix E-4 (2026-04-19, feedback
 * `ACEH_Ilshzp`). Recipes imported from social captions sometimes land
 * with `source_name` set but `source_url` null (caption extraction
 * recovers the creator handle even when the URL parse fails). The mobile
 * detail screen previously gated the entire source card on
 * `recipe.source_url &&`, so those rows showed no attribution at all.
 *
 * The fix widens the gate to `(source_url || source_name)` and handles
 * three render modes:
 *   - url only               → URL link (legacy)
 *   - both url + name        → name as link text, opens url
 *   - name only              → plain "Source · {name}", no href, no
 *                              synthesised URL
 *
 * Web counterpart: `src/app/components/RecipeDetail.tsx` is the in-app
 * recipe viewer. It does NOT fetch `source_url` / `source_name` and does
 * NOT render a source card in any mode — that surface predates the
 * `source_*` columns (migration `20260411180000`). The public SSR recipe
 * page at `app/recipe/[id]/page.tsx` also omits a source card. There is
 * therefore no web gate to mirror right now; the parity test captures
 * that gap so the next web detail refactor closes it rather than
 * silently diverging further. When that web card lands, extend this test
 * with the same three render-mode assertions against the new file.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MOBILE_DETAIL_PATH = resolve(__dirname, "../../app/recipe/[id].tsx");
const WEB_DETAIL_PATH = resolve(
  __dirname,
  "../../../../src/app/components/RecipeDetail.tsx",
);
const WEB_PUBLIC_PATH = resolve(
  __dirname,
  "../../../../app/recipe/[id]/page.tsx",
);

const MOBILE_SRC = readFileSync(MOBILE_DETAIL_PATH, "utf8");
const WEB_DETAIL_SRC = readFileSync(WEB_DETAIL_PATH, "utf8");
const WEB_PUBLIC_SRC = readFileSync(WEB_PUBLIC_PATH, "utf8");

describe("mobile source card — widened render gate (E-4)", () => {
  it("gates the source card on (source_url || source_name), not source_url alone", () => {
    // The gate must explicitly allow through rows where only
    // `source_name` is set — that's the whole point of the fix.
    // The source expresses this as a ternary (`source_url || source_name ? (`)
    // which is semantically equivalent to the `&&` short-circuit form.
    // Match the logical OR gate regardless of whether it uses && or ternary.
    expect(MOBILE_SRC).toMatch(
      /recipe\.source_url\s*\|\|\s*recipe\.source_name/,
    );
  });

  it("does not gate on `source_url &&` alone any more", () => {
    // Pre-fix the gate was `{recipe.source_url && (...)}` — we strip the
    // trailing `&&` so the regex doesn't flag the widened gate that
    // contains `source_url ||` as a substring.
    expect(MOBILE_SRC).not.toMatch(/\{\s*recipe\.source_url\s*&&\s*\(/);
  });

  it("keeps the link branch when source_url is truthy", () => {
    // The "both" render mode keeps the existing link text + Linking.openURL.
    expect(MOBILE_SRC).toMatch(/recipe\.source_url\s*\?\s*\(/);
    expect(MOBILE_SRC).toMatch(/Linking\.openURL\(recipe\.source_url!\)/);
    expect(MOBILE_SRC).toMatch(/View original recipe/);
  });

  it("renders plain `Source · {name}` when only source_name is set", () => {
    // No href must be synthesised — TestFlight ticket explicitly
    // forbids inventing URLs when the extractor could not recover one.
    expect(MOBILE_SRC).toMatch(/`Source · \$\{recipe\.source_name\}`/);
  });

  it("does not synthesise a URL from source_name", () => {
    // Belt-and-braces: no `https://` prepended to `source_name`, no
    // `openURL(...source_name)` call in the name-only branch.
    const nameOnlyBranchStart = MOBILE_SRC.indexOf("Source · ${recipe.source_name}");
    expect(nameOnlyBranchStart).toBeGreaterThan(-1);
    // Grab a small slice around the name-only branch and assert no
    // Linking.openURL call lands inside it.
    const slice = MOBILE_SRC.slice(
      Math.max(0, nameOnlyBranchStart - 200),
      nameOnlyBranchStart + 200,
    );
    // The slice is the `else` arm of the ternary; it must not contain
    // a Linking.openURL call.
    expect(slice).not.toMatch(/Linking\.openURL\([^)]*source_name/);
  });
});

describe("web recipe detail — known-gap parity note (E-4)", () => {
  it("web in-app RecipeDetail still does not render a source card", () => {
    // Latent gap recorded in docs/testflight-feedback/resolved.md
    // (build 10 entry, 2026-04-19). When this assertion starts failing
    // because someone added a web source card, replace it with the same
    // three render-mode pins used for mobile above.
    //
    // 2026-04-30 — narrowed from a blanket `/source_url/` scan to the
    // canonical mobile source-card markers (`Source · `, `View original
    // recipe`). The Recime parity quick-win added a `source_url` JS
    // property key in a helper call (`pickHeroImageUrl({ source_url:
    // recipe.sourceUrl })`) — that's a hero-image fallback, not a
    // source attribution card, and shouldn't trip this gap tracker.
    expect(WEB_DETAIL_SRC).not.toMatch(/Source · \$\{recipe\.source_name/);
    expect(WEB_DETAIL_SRC).not.toMatch(/View original recipe/);
  });

  it("public SSR recipe page still does not render a source card", () => {
    expect(WEB_PUBLIC_SRC).not.toMatch(/View original recipe/);
  });
});
