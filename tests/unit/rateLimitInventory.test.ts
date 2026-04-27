/**
 * P0-6 (2026-04-25) — meta-test pinning that every authenticated route
 * (one that calls `getUserIdFromRequest` or `getUserIdFromAuthHeader`
 * AND `rateLimit`) passes its `userId` to `rateLimit`. Otherwise the
 * bucket falls back to `anon:<ip>` and a shared NAT can starve every
 * authenticated user on it.
 *
 * Public / anonymous routes (no auth call) are exempt — their buckets
 * legitimately scope by IP alone.
 *
 * Adding a new authenticated route that calls `rateLimit` without
 * `userId` fails this test. Fix: thread `userId` into the rateLimit
 * options.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO = resolve(__dirname, "../..");
const API_DIR = resolve(REPO, "app/api");

function* walkRoutes(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) {
      yield* walkRoutes(p);
    } else if (name === "route.ts" || name === "route.tsx") {
      yield p;
    }
  }
}

describe("rateLimit user-scoping inventory", () => {
  it("every authenticated route that calls rateLimit also passes userId", () => {
    const offenders: { file: string; reason: string }[] = [];

    for (const path of walkRoutes(API_DIR)) {
      const text = readFileSync(path, "utf8");
      const callsRateLimit = /\brateLimit\s*\(/.test(text);
      if (!callsRateLimit) continue;

      const callsAuth =
        /getUserIdFromRequest\b/.test(text) || /getUserIdFromAuthHeader\b/.test(text);
      if (!callsAuth) {
        // Public / anonymous route — IP-only scoping is correct.
        continue;
      }

      // Authenticated route. Each `rateLimit({ ... })` call object must
      // include a `userId` field.
      const callRe = /rateLimit\s*\(\s*\{([^}]*)\}\s*\)/gms;
      let m: RegExpExecArray | null;
      let badCalls = 0;
      while ((m = callRe.exec(text)) !== null) {
        const body = m[1] ?? "";
        if (!/\buserId\s*[:,}]/.test(body)) {
          badCalls += 1;
        }
      }
      if (badCalls > 0) {
        offenders.push({
          file: path.replace(REPO + "/", ""),
          reason: `${badCalls} rateLimit() call(s) without userId despite the route authenticating`,
        });
      }
    }

    if (offenders.length > 0) {
      const detail = offenders
        .map((o) => `  - ${o.file}: ${o.reason}`)
        .join("\n");
      throw new Error(
        `Authenticated routes calling rateLimit without per-user scoping:\n${detail}\n\nFix: pass \`userId\` (from getUserIdFromRequest / getUserIdFromAuthHeader) into the rateLimit options. See P0-6 decision doc.`,
      );
    }

    expect(offenders).toEqual([]);
  });
});
