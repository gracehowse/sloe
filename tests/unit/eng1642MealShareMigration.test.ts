/**
 * @vitest-environment node
 *
 * ENG-1642 — meal share links SQL contract pins. One test group per
 * security-relevant clause of `create_meal_share` / `get_meal_share` /
 * `revoke_meal_share` and the `meal_shares` table, mirroring the
 * `eng1320ReferralFraudControls.test.ts` read-the-file-verbatim style —
 * these guard against a future edit silently loosening the anon-readable
 * share surface (e.g. widening a grant, dropping the search_path pin, or
 * relaxing the token format) without anyone noticing at review time.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260722090000_eng1642_meal_share_links.sql";
const sql = readFileSync(resolve(process.cwd(), migrationPath), "utf8");
const normalized = sql.replace(/\s+/g, " ");
// Executable statements only — SQL comments stripped:
const code = sql.replace(/--[^\n]*/g, "").replace(/\s+/g, " ");

function functionBody(name: string, nextMarker: string): string {
  const start = normalized.indexOf(`create or replace function public.${name}`);
  const end = normalized.indexOf(nextMarker, start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return normalized.slice(start, end);
}

// Boundaries are the START of the next function (not the trailing comment
// block) — create_meal_share/get_meal_share/revoke_meal_share are defined
// back-to-back, so slicing to a `comment on function ...` marker instead
// would silently swallow the next function's body too.
function createBody(): string {
  return functionBody(
    "create_meal_share",
    "create or replace function public.get_meal_share",
  );
}

function getBody(): string {
  return functionBody(
    "get_meal_share",
    "create or replace function public.revoke_meal_share",
  );
}

function revokeBody(): string {
  return functionBody(
    "revoke_meal_share",
    "revoke all on function public.create_meal_share(text, text, jsonb) from public;",
  );
}

describe("ENG-1642 — all three RPCs are SECURITY DEFINER with a pinned search_path", () => {
  it("create_meal_share, get_meal_share, and revoke_meal_share each pin search_path", () => {
    for (const body of [createBody(), getBody(), revokeBody()]) {
      expect(body).toContain("security definer");
      expect(body).toContain("set search_path = public, pg_temp");
    }
  });

  it("pins the exact clause exactly three times across the migration", () => {
    const matches = normalized.match(/security definer set search_path = public, pg_temp/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(3);
  });
});

describe("ENG-1642 — function grants", () => {
  it("revokes all three functions from public before any positive grant", () => {
    expect(normalized).toContain(
      "revoke all on function public.create_meal_share(text, text, jsonb) from public;",
    );
    expect(normalized).toContain(
      "revoke all on function public.get_meal_share(text) from public;",
    );
    expect(normalized).toContain(
      "revoke all on function public.revoke_meal_share(uuid) from public;",
    );
  });

  it("grants get_meal_share to anon AND authenticated", () => {
    expect(normalized).toContain(
      "grant execute on function public.get_meal_share(text) to anon, authenticated;",
    );
  });

  it("grants create_meal_share and revoke_meal_share to authenticated ONLY — no anon grant", () => {
    expect(normalized).toContain(
      "grant execute on function public.create_meal_share(text, text, jsonb) to authenticated;",
    );
    expect(normalized).toContain(
      "grant execute on function public.revoke_meal_share(uuid) to authenticated;",
    );
    // The only "to anon" grant in the whole migration is get_meal_share's.
    const anonGrants = code.match(/grant execute[^;]*to[^;]*\banon\b[^;]*;/g) ?? [];
    expect(anonGrants.length).toBe(1);
    expect(anonGrants[0]).toContain("get_meal_share");
  });
});

describe("ENG-1642 — table lockdown + RLS", () => {
  it("revokes all table access from anon and every write from authenticated", () => {
    expect(normalized).toContain("revoke all on table public.meal_shares from anon;");
    expect(normalized).toContain(
      "revoke insert, update, delete, truncate, references, trigger on table public.meal_shares from authenticated;",
    );
  });

  it("has exactly one RLS policy — select-own for authenticated — and no insert/update/delete policy", () => {
    const policyMatches = code.match(/create policy/g) ?? [];
    expect(policyMatches.length).toBe(1);
    expect(normalized).toContain(
      'create policy "meal_shares_select_own" on public.meal_shares for select to authenticated using (created_by = auth.uid());',
    );
    expect(code).not.toMatch(/create policy[^;]*for insert/);
    expect(code).not.toMatch(/create policy[^;]*for update/);
    expect(code).not.toMatch(/create policy[^;]*for delete/);
  });

  it("enables row level security on the table", () => {
    expect(normalized).toContain("alter table public.meal_shares enable row level security;");
  });
});

describe("ENG-1642 — token format + generation", () => {
  it("constrains the token column to lowercase 32-hex via CHECK", () => {
    expect(normalized).toContain("check (token ~ '^[a-f0-9]{32}$')");
  });

  it("generates the token from 16 random bytes (128 bits) hex-encoded", () => {
    expect(normalized).toContain("gen_random_bytes(16), 'hex'");
  });

  it("normalises an inbound token to lowercase hex and requires length 32 before any lookup", () => {
    const body = getBody();
    expect(body).toContain(
      "lower(regexp_replace(coalesce(p_token, ''), '[^a-fA-F0-9]', '', 'g'))",
    );
    expect(body).toContain("if length(v_token) <> 32 then");
  });
});

describe("ENG-1642 — create_meal_share rate limit", () => {
  it("counts shares in the trailing 24h window and rejects at >= 100", () => {
    const body = createBody();
    expect(body).toMatch(
      /where created_by = v_uid and created_at > now\(\) - interval '24 hours';/,
    );
    expect(body).toContain("if v_recent >= 100 then");
    expect(body).toContain("'rate_limited'");
  });
});

describe("ENG-1642 — published-recipe guard on recipe_id", () => {
  it("keeps recipe_id only when it points at a published recipe", () => {
    const body = createBody();
    expect(body).toMatch(
      /select 1 from public\.recipes r where r\.id = v_recipe_id and r\.published = true/,
    );
  });
});

describe("ENG-1642 — expiry default", () => {
  it("defaults expires_at to 30 days from creation", () => {
    expect(normalized).toContain(
      "expires_at timestamptz not null default (now() + interval '30 days'),",
    );
  });

  it("checks expiry at read time in get_meal_share, not via a cron", () => {
    const body = getBody();
    expect(body).toContain("if v_row.expires_at <= now() then");
  });
});

describe("ENG-1642 — get_meal_share statuses", () => {
  it("returns invalid for an unrecognised/malformed token or missing row", () => {
    const body = getBody();
    expect(body).toContain("return jsonb_build_object('status', 'invalid');");
  });

  it("returns expired for a lapsed share", () => {
    const body = getBody();
    expect(body).toMatch(
      /if v_row\.expires_at <= now\(\) then return jsonb_build_object\('status', 'expired'\);/,
    );
  });

  it("returns revoked for a revoked share", () => {
    const body = getBody();
    expect(body).toMatch(
      /if v_row\.revoked_at is not null then return jsonb_build_object\('status', 'revoked'\);/,
    );
  });

  it("returns ok with the payload fields and never created_by", () => {
    const body = getBody();
    expect(body).toContain("'status', 'ok'");
    expect(body).toContain("'title', v_row.title");
    expect(body).toContain("'meal_slot', v_row.meal_slot");
    // `items` is the READ-TIME re-checked `v_items`, not the raw stored
    // `v_row.items` — see the "stale recipe_id" describe block below.
    expect(body).toContain("'items', v_items");
    expect(body).toContain("'shared_by', v_shared_by");
    expect(body).toContain("'created_at', v_row.created_at");
    expect(body).not.toContain("created_by'");
    expect(body).not.toContain("'created_by'");
  });
});

describe("ENG-1642 — create_meal_share rate-limit race safety", () => {
  it("takes a per-user advisory xact lock before counting the 24h window", () => {
    const body = createBody();
    const lockIdx = body.indexOf("pg_advisory_xact_lock");
    const countIdx = body.indexOf("select count(*) into v_recent");
    expect(lockIdx).toBeGreaterThan(-1);
    expect(countIdx).toBeGreaterThan(lockIdx);
    // Locked per-user (hashtext(v_uid::text)), not a single global lock that
    // would serialize every user's share creation against each other.
    expect(body).toContain("hashtext(v_uid::text)");
  });
});

describe("ENG-1642 — get_meal_share strips stale recipe_id at read time", () => {
  it("re-checks each item's recipe_id against a live published lookup, not just create-time state", () => {
    const body = getBody();
    // Guards against a recipe going private/deleted in the up-to-30-day
    // window between share creation and a recipient opening the link —
    // create-time validation alone would keep serving a since-invalid id.
    expect(body).toMatch(
      /not exists \(\s*select 1 from public\.recipes r\s*where r\.id = \(e\.item->>'recipe_id'\)::uuid\s*and r\.published = true\s*\)/,
    );
    // Only the recipe_id key is dropped from an item with a stale id — the
    // rest of the item (title/macros/micros) still reaches the recipient.
    expect(body).toContain("then e.item - 'recipe_id'");
    expect(body).toContain("else e.item");
  });

  it("defaults to an empty items array rather than NULL when a share has zero items", () => {
    const body = getBody();
    expect(body).toContain("coalesce(jsonb_agg(");
    expect(body).toContain("'[]'::jsonb)");
  });
});

describe("ENG-1642 — create_meal_share micros bound (mirrors mealShareLink.ts's MICRO_VALUE_MAX)", () => {
  it("bounds each micro value to between 0 and 100000 inside the jsonb_each filter", () => {
    const body = createBody();
    expect(body).toMatch(
      /and \(e\.value\)::numeric between 0 and 100000;/,
    );
    // The filter runs inside the per-item jsonb_each loop that builds
    // v_micros, not a separate/duplicated check elsewhere.
    expect(body).toContain("from jsonb_each(v_item->'nutrition_micros') as e(key, value)");
    const filterIdx = body.indexOf("from jsonb_each(v_item->'nutrition_micros')");
    const boundIdx = body.indexOf("(e.value)::numeric between 0 and 100000");
    expect(filterIdx).toBeGreaterThan(-1);
    expect(boundIdx).toBeGreaterThan(filterIdx);
  });
});

describe("ENG-1642 — no cross-user read of nutrition_entries", () => {
  it("never references nutrition_entries in any executable statement (comments describe the posture, not code)", () => {
    // The module doc comments intentionally NAME nutrition_entries to explain
    // why it's untouched (the recipient re-logs into their own rows via a
    // separate insert path elsewhere, not via anything in this migration).
    // What must never appear is a reference inside actual SQL — a grant, a
    // select, a function body touching that table.
    expect(code).not.toContain("nutrition_entries");
  });
});
