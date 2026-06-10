/**
 * Web mirror — `.screen-title` / `.nav-title` utility classes (Spec 3,
 * 2026-06-09).
 *
 * Mobile consolidated five push-screen H1s onto `Type.screenTitle`
 * (Newsreader serif 28/600) + moved the nav-bar-row title to `Type.navTitle`
 * (serif 18/500). The web mirror is two utility classes in
 * `src/styles/theme.css` so the equivalent web sub-screen H1s read in the
 * same serif voice. This pins that the classes exist and resolve to the
 * intended tokens (serif family + the 28px / 18px sizes + the 600 / 500
 * weights), so the cross-platform title voice can't silently drift.
 *
 * Mobile side: `apps/mobile/tests/unit/screenTitleSerif.test.ts`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const THEME_CSS = readFileSync(resolve(ROOT, "src/styles/theme.css"), "utf8");

/** Extract the body of a single CSS rule by its selector. */
function rule(selector: string): string {
  const idx = THEME_CSS.indexOf(`${selector} {`);
  expect(idx, `${selector} rule missing in theme.css`).toBeGreaterThanOrEqual(0);
  const open = THEME_CSS.indexOf("{", idx);
  const close = THEME_CSS.indexOf("}", open);
  return THEME_CSS.slice(open + 1, close);
}

describe("Web screen-title / nav-title mirror classes", () => {
  it(".screen-title is the serif headline family at the 28px (3xl) size, weight 600", () => {
    const body = rule(".screen-title");
    expect(body).toMatch(/font-family:\s*var\(--font-headline\)/);
    expect(body).toMatch(/font-size:\s*var\(--text-3xl\)/); // 28px — mirrors mobile screenTitle
    expect(body).toMatch(/font-weight:\s*var\(--font-weight-semibold\)/); // 600
  });

  it(".nav-title is the serif headline family at the 18px (lg) size, weight 500", () => {
    const body = rule(".nav-title");
    expect(body).toMatch(/font-family:\s*var\(--font-headline\)/);
    expect(body).toMatch(/font-size:\s*var\(--text-lg\)/); // 18px — mirrors mobile navTitle
    expect(body).toMatch(/font-weight:\s*var\(--font-weight-medium\)/); // 500
  });

  it("the --text-3xl token is 28px (the mobile screenTitle size) — drift guard", () => {
    expect(THEME_CSS).toMatch(/--text-3xl:\s*1\.75rem;/); // 1.75rem = 28px
    expect(THEME_CSS).toMatch(/--text-lg:\s*1\.125rem;/); // 1.125rem = 18px
  });
});
