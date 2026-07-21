import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO = resolve(__dirname, "../..");

describe("ENG-608 web route completion", () => {
  it("exposes App Router pages for create, import, and profile", () => {
    for (const segment of ["create", "import", "profile"]) {
      const grouped = resolve(REPO, `app/(product)/${segment}/page.tsx`);
      const flat = resolve(REPO, `app/${segment}/page.tsx`);
      const pagePath = existsSync(grouped) ? grouped : flat;
      expect(existsSync(pagePath), `${segment} page missing`).toBe(true);
    }
    const layoutPath = resolve(REPO, "app/(product)/layout.tsx");
    if (existsSync(layoutPath)) {
      const layout = readFileSync(layoutPath, "utf8");
      expect(layout).toContain("HomePageClient");
    }
  });

  it("maps canonical path segments to App views", () => {
    const appSrc = readFileSync(resolve(REPO, "src/app/App.tsx"), "utf8");
    expect(appSrc).toMatch(/create:\s*"create"/);
    expect(appSrc).toMatch(/import:\s*"import"/);
    expect(appSrc).toMatch(/profile:\s*"profile"/);
  });

  // ENG-669 (launch-blocker): `/import` was a blank white page. Two
  // things must be true for the route to render its (already-built)
  // import UI, and the blank-page bug was caused by the FIRST being
  // absent: (1) the `pathDerivedView` map must include the `import`
  // segment so the URL switches `currentView` to "import"; (2)
  // `renderView()` must have a `case "import"` that renders
  // `<RecipeUpload mode="import" />`. Pin BOTH so removing either half
  // reintroduces the blank page and breaks this test. The rendered UI
  // itself is pinned by `tests/unit/recipeImportSurface.test.tsx`.
  it("renders RecipeUpload(mode=import) for the /import view (ENG-669)", () => {
    const appSrc = readFileSync(resolve(REPO, "src/app/App.tsx"), "utf8");
    // (1) path → view is reachable.
    expect(appSrc).toMatch(/import:\s*"import"/);
    // (2) the view renders the import surface, in import mode.
    expect(appSrc).toMatch(/case\s+"import":/);
    expect(appSrc).toMatch(/mode="import"/);
    // The create twin is wired the same way (it also returned a blank
    // page before the path→view map carried the segment).
    expect(appSrc).toMatch(/case\s+"create":/);
    expect(appSrc).toMatch(/mode="create"/);
  });

  // ENG-696 — the web Plan-Import surface must be reachable at /plan-import.
  // Same two-part wiring as /import: (1) the path→view map carries the
  // `plan-import` segment so the URL switches `currentView`; (2)
  // `renderView()` has a `case "plan-import"` that renders <PlanImport />.
  // The rendered UI is pinned in `tests/unit/planImportSurface.test.tsx`.
  it("renders PlanImport for the /plan-import view (ENG-696)", () => {
    const pagePath = resolve(REPO, "app/(product)/plan-import/page.tsx");
    expect(existsSync(pagePath), "plan-import page missing").toBe(true);
    const appSrc = readFileSync(resolve(REPO, "src/app/App.tsx"), "utf8");
    // (1) path → view is reachable.
    expect(appSrc).toMatch(/"plan-import":\s*"plan-import"/);
    // (2) the view renders the PlanImport surface.
    expect(appSrc).toMatch(/case\s+"plan-import":/);
    expect(appSrc).toMatch(/<PlanImport /);
    // Gated on the same flag the mobile entry points use.
    expect(appSrc).toContain("plan_import_enabled");
  });

  // ENG-1582 — the web Cookbook-Import surface must be reachable at /cookbook-import.
  it("renders CookbookImport for the /cookbook-import view (ENG-1582)", () => {
    const pagePath = resolve(REPO, "app/(product)/cookbook-import/page.tsx");
    expect(existsSync(pagePath), "cookbook-import page missing").toBe(true);
    const appSrc = readFileSync(resolve(REPO, "src/app/App.tsx"), "utf8");
    expect(appSrc).toMatch(/"cookbook-import":\s*"cookbook-import"/);
    expect(appSrc).toMatch(/case\s+"cookbook-import":/);
    expect(appSrc).toMatch(/<CookbookImport/);
    expect(appSrc).toContain("cookbook_import_enabled");
  });

  // ENG-622 — the web Targets surface must be reachable at /targets on a
  // hard reload / deep link (the in-app SPA nav already worked). Same two-part
  // wiring: (1) the path→view map carries the `targets` segment; (2)
  // `renderView()` has a `case "targets"` that renders <Targets />.
  it("renders Targets for the /targets view (ENG-622)", () => {
    const pagePath = resolve(REPO, "app/(product)/targets/page.tsx");
    expect(existsSync(pagePath), "targets page missing").toBe(true);
    const appSrc = readFileSync(resolve(REPO, "src/app/App.tsx"), "utf8");
    // (1) path → view is reachable.
    expect(appSrc).toMatch(/targets:\s*"targets"/);
    // (2) the view renders the Targets surface.
    expect(appSrc).toMatch(/case\s+"targets":/);
    expect(appSrc).toMatch(/<Targets/);
  });

  it("navigates log sheet and checkout success to /today", () => {
    const appSrc = readFileSync(resolve(REPO, "src/app/App.tsx"), "utf8");
    expect(appSrc).toMatch(/\/today\?openLog=1/);
    expect(appSrc).not.toMatch(/router\.replace\([^)]*\/home\?[^)]*openLog/);
    expect(appSrc).toMatch(/router\.replace\(q \? `\/today\?\$\{q\}` : "\/today"/);
  });
});
