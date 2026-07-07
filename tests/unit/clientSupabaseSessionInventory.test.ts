/**
 * ENG-1470 (2026-07-07) — meta-test pinning that no "use client" component
 * under `app/` or `src/app/` instantiates its own Supabase client via
 * `createClient(...)` from `@supabase/supabase-js`.
 *
 * Why this matters: the real app session is established through
 * `src/lib/supabase/browserClient.ts`'s `supabase` export
 * (`createBrowserClient` from `@supabase/ssr`), which stores the session in
 * COOKIES so both server and client code can read it. Plain `supabase-js`'s
 * `createClient` defaults to LOCALSTORAGE session storage — a completely
 * separate, non-interoperable store. A component that instantiates its own
 * client via `createClient(...)` can NEVER see a session the real app
 * established; `supabase.auth.getSession()` silently resolves to `null`
 * forever, even for a genuinely logged-in user.
 *
 * This bit four real components before this fix: `CurrentTierBadge.tsx`
 * ("Your current plan" badge never showed), `PricingPaywallHonesty.tsx`
 * (personalised paywall lead never showed), `CheckoutButton.tsx` AND
 * `upgrade-paywall-dialog.tsx` (an already-logged-in user clicking "Upgrade
 * to Pro" was silently bounced to /login instead of Stripe checkout — a
 * live monetisation-blocking bug). Found while building `PricingHeaderAuth`
 * (ENG-1460) and generalised to every client component (ENG-1470).
 *
 * Fix for any new offender: import the shared `supabase` export from
 * `src/lib/supabase/browserClient.ts` instead of instantiating a new client.
 *
 * Server-only files (API routes, server components with no "use client",
 * `serverAnonClient.ts` / `serverAdminClient.ts`) are exempt — they have no
 * browser session to read; a fresh anon/service-role client per request is
 * correct there. This test only walks "use client" files.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO = resolve(__dirname, "../..");
const SCAN_DIRS = [resolve(REPO, "app"), resolve(REPO, "src/app")];

function* walkFiles(dir: string): Generator<string> {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    const p = join(dir, name);
    let s;
    try {
      s = statSync(p);
    } catch {
      continue;
    }
    if (s.isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      yield* walkFiles(p);
    } else if (/\.(tsx|ts)$/.test(name) && !/\.test\.(tsx|ts)$/.test(name)) {
      yield p;
    }
  }
}

describe("ENG-1470 — client components use the shared cookie-backed Supabase client", () => {
  it("no \"use client\" file under app/ or src/app/ instantiates createClient from @supabase/supabase-js", () => {
    const offenders: string[] = [];

    for (const dir of SCAN_DIRS) {
      for (const path of walkFiles(dir)) {
        const text = readFileSync(path, "utf8");
        const isClientComponent = /^["']use client["'];?/m.test(text);
        if (!isClientComponent) continue;

        const importsPlainSupabaseJs =
          /from\s+["']@supabase\/supabase-js["']/.test(text) &&
          /\bcreateClient\s*\(/.test(text);
        if (importsPlainSupabaseJs) {
          offenders.push(path.replace(REPO + "/", ""));
        }
      }
    }

    expect(
      offenders,
      `Client components instantiating their own supabase-js client (localStorage session — invisible to the real cookie-backed app session). Import { supabase } from "src/lib/supabase/browserClient.ts" instead:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
