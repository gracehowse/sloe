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

  it("navigates log sheet and checkout success to /today", () => {
    const appSrc = readFileSync(resolve(REPO, "src/app/App.tsx"), "utf8");
    expect(appSrc).toMatch(/\/today\?openLog=1/);
    expect(appSrc).not.toMatch(/router\.replace\([^)]*\/home\?[^)]*openLog/);
    expect(appSrc).toMatch(/router\.replace\(q \? `\/today\?\$\{q\}` : "\/today"/);
  });
});
