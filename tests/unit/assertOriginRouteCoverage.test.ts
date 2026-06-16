/**
 * ENG-1137 — every browser-facing POST API route must call assertOrigin
 * unless it is a server-to-server webhook/cron endpoint.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const EXEMPT_POST_ROUTES = new Set([
  "app/api/stripe/webhook/route.ts",
  "app/api/revenuecat/webhook/route.ts",
  "app/api/push/weekly-recap/route.ts",
]);

function collectRouteFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectRouteFiles(full, acc);
    } else if (entry === "route.ts") {
      acc.push(full);
    }
  }
  return acc;
}

describe("ENG-1137 assertOrigin route coverage", () => {
  it("every cookie-auth POST route calls assertOrigin or is exempt", () => {
    const root = join(process.cwd(), "app/api");
    const routes = collectRouteFiles(root);
    const missing: string[] = [];

    for (const absolute of routes) {
      const rel = absolute.replace(`${process.cwd()}/`, "");
      const src = readFileSync(absolute, "utf8");
      if (!src.includes("export async function POST")) continue;
      if (EXEMPT_POST_ROUTES.has(rel)) continue;
      if (!src.includes("assertOrigin")) {
        missing.push(rel);
      }
    }

    expect(missing).toEqual([]);
  });
});
