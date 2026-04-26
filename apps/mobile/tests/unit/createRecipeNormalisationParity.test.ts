/**
 * Structural parity pin for the Create Recipe + Upload write paths.
 *
 * Context — TestFlight build 10 fix E-1 (2026-04-19, feedback
 * `AO4NtyNB`). The mobile Create Recipe form placeholder previously
 * rendered `\n` literally (JSX attribute strings don't interpret
 * escapes), teaching users to type the escape sequence — which then
 * landed raw in `recipes.instructions`. The fix bundles:
 *
 *   1. A braced placeholder expression so the `\n` becomes a real newline
 *      at render time.
 *   2. A shared `normaliseInstructions` helper called on the write side
 *      of every recipe-insert surface so no new rows land with `\n` / `/n`
 *      typos — even for users still typing them into other channels.
 *
 * This is a source-level regression pin because RNTL can't render the
 * Expo Router screen in the vitest/jsdom environment yet (same reason as
 * `cookAnalyticsParity.test.ts`). If the forms refactor, these pins keep
 * the helper import + call intact on both surfaces.
 *
 * Files pinned:
 *   - Mobile create form: `apps/mobile/app/create-recipe.tsx`
 *   - Mobile import save: `apps/mobile/lib/saveImportedRecipe.ts`
 *   - Web upload form:    `src/app/components/RecipeUpload.tsx`
 *
 * Note: there is no standalone web "create manual recipe" page — the
 * web surface is `RecipeUpload.tsx` which handles both manual create
 * (`mode="create"`) and URL import (`mode="import"`). That file is the
 * parity counterpart to the mobile create form.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MOBILE_CREATE_PATH = resolve(__dirname, "../../app/create-recipe.tsx");
const MOBILE_IMPORT_PATH = resolve(__dirname, "../../lib/saveImportedRecipe.ts");
const WEB_UPLOAD_PATH = resolve(
  __dirname,
  "../../../../src/app/components/RecipeUpload.tsx",
);

const MOBILE_CREATE_SRC = readFileSync(MOBILE_CREATE_PATH, "utf8");
const MOBILE_IMPORT_SRC = readFileSync(MOBILE_IMPORT_PATH, "utf8");
const WEB_UPLOAD_SRC = readFileSync(WEB_UPLOAD_PATH, "utf8");

describe("mobile create-recipe — placeholder + write-side normalise (E-1)", () => {
  it("imports normaliseInstructions from the shared helper", () => {
    expect(MOBILE_CREATE_SRC).toMatch(
      /import\s*\{\s*normaliseInstructions\s*\}\s*from\s*["'][^"']*src\/lib\/recipes\/normaliseInstructions["']/,
    );
  });

  it("calls normaliseInstructions on the save-path instructions field", () => {
    // Pin both the call and the Supabase insert that follows so a refactor
    // that drops the normaliser but keeps the import doesn't slip through.
    expect(MOBILE_CREATE_SRC).toMatch(
      /instructions:\s*normaliseInstructions\(instructions\)\s*\|\|\s*null/,
    );
    expect(MOBILE_CREATE_SRC).toMatch(/from\(["']recipes["']\)\s*\.insert/);
  });

  it("placeholder is single-line text — no \\n escape leaks (P1-26)", () => {
    // P1-26 (TestFlight `AO4NtyNBpP4FJRgq7mCV5cs`, 2026-04-25):
    // even the braced `{"...\n..."}` form still rendered as a literal
    // backslash-n inside `TextInput.placeholder` on iOS. Switched to a
    // single-line directive so the escape can never leak.
    expect(MOBILE_CREATE_SRC).toMatch(/placeholder="Describe each step on a new line"/);
    // Defence: no JSX attribute string should carry a `\n` escape.
    expect(MOBILE_CREATE_SRC).not.toMatch(/placeholder="[^"{]*\\n[^"]*"/);
    // Defence: no braced placeholder containing a multi-step Step 1/Step 2 pattern.
    expect(MOBILE_CREATE_SRC).not.toMatch(/placeholder=\{[^}]*Step 1.*Step 2[^}]*\}/);
  });
});

describe("mobile import save path — normaliseInstructions wired in (E-1)", () => {
  it("imports the shared helper", () => {
    expect(MOBILE_IMPORT_SRC).toMatch(
      /import\s*\{\s*normaliseInstructions\s*\}\s*from\s*["'][^"']*src\/lib\/recipes\/normaliseInstructions["']/,
    );
  });

  it("routes instructions through normaliseInstructions before insert", () => {
    // The import save path wraps its array/string normaliser around
    // the shared helper — both code paths (array of steps and raw string)
    // run through the same sanitiser.
    expect(MOBILE_IMPORT_SRC).toMatch(/normaliseInstructions\(/);
    expect(MOBILE_IMPORT_SRC).toMatch(/from\(["']recipes["']\)\s*\n?\s*\.insert/);
  });
});

describe("web recipe upload — parity with mobile create on normalise (E-1)", () => {
  it("imports normaliseInstructions from the shared helper", () => {
    expect(WEB_UPLOAD_SRC).toMatch(
      /import\s*\{\s*normaliseInstructions\s*\}\s*from\s*["'][^"']*lib\/recipes\/normaliseInstructions/,
    );
  });

  it("calls normaliseInstructions on the upsert-path instructions field", () => {
    expect(WEB_UPLOAD_SRC).toMatch(
      /instructions:\s*normaliseInstructions\(instructions\)/,
    );
    expect(WEB_UPLOAD_SRC).toMatch(/from\(["']recipes["']\)\s*\n?\s*\.upsert/);
  });

  it("no longer uses the inline .trim() on instructions", () => {
    // Pre-fix the code was `instructions: instructions.trim(),` which
    // left `\n` / `/n` typos intact. The replacement must not coexist
    // with the old call shape.
    expect(WEB_UPLOAD_SRC).not.toMatch(/instructions:\s*instructions\.trim\(\)/);
  });
});
