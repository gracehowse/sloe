import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * T21 (full-sweep 2026-04-24) — pin the claim_web_push_subscription
 * RPC contract. Live behaviour requires a Supabase instance to test
 * the cross-user reassignment; this file pins the SQL shape so the
 * security-critical pieces can't silently regress.
 */

const SQL = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260503100600_claim_web_push_subscription.sql"),
  "utf-8",
);

describe("claim_web_push_subscription RPC migration shape", () => {
  it("declares the function with the expected signature", () => {
    expect(SQL).toMatch(
      /create or replace function public\.claim_web_push_subscription\s*\(\s*p_endpoint text,\s*p_p256dh text,\s*p_auth text,\s*p_user_agent text default null\s*\)/i,
    );
  });

  it("uses SECURITY DEFINER so the DELETE is not blocked by the previous owner's RLS policy", () => {
    expect(SQL).toMatch(/security definer/i);
    expect(SQL).not.toMatch(/security invoker/i);
  });

  it("rejects unauthenticated callers with 42501", () => {
    expect(SQL).toMatch(/auth\.uid\(\)/);
    expect(SQL).toMatch(/42501/);
  });

  it("validates endpoint / p256dh / auth presence with 22023", () => {
    expect(SQL).toMatch(/endpoint is required/i);
    expect(SQL).toMatch(/p256dh is required/i);
    expect(SQL).toMatch(/auth is required/i);
    const errcode22023 = (SQL.match(/22023/g) ?? []).length;
    expect(errcode22023).toBeGreaterThanOrEqual(3);
  });

  it("DELETEs the existing row for the endpoint regardless of current owner, then INSERTs", () => {
    const deleteCount = (SQL.match(/delete from public\.web_push_subscriptions/gi) ?? []).length;
    expect(deleteCount).toBe(1);
    const insertCount = (SQL.match(/insert into public\.web_push_subscriptions/gi) ?? []).length;
    expect(insertCount).toBe(1);
    const deleteIdx = SQL.toLowerCase().indexOf("delete from public.web_push_subscriptions");
    const insertIdx = SQL.toLowerCase().indexOf("insert into public.web_push_subscriptions");
    expect(deleteIdx).toBeGreaterThan(0);
    expect(insertIdx).toBeGreaterThan(deleteIdx);
    // The DELETE must NOT scope by user_id — the whole point is that
    // it can clear a row owned by a different user. Pin the WHERE
    // clause explicitly so a future "tightening" can't silently
    // reintroduce the leak.
    const deleteSlice = SQL.slice(deleteIdx, insertIdx).toLowerCase();
    expect(deleteSlice).toContain("where endpoint = p_endpoint");
    expect(deleteSlice).not.toContain("user_id");
  });

  it("INSERT writes user_id from auth.uid(), endpoint + keys + user_agent + last_seen_at", () => {
    const insertSlice = SQL.slice(SQL.toLowerCase().indexOf("insert into public.web_push_subscriptions"));
    expect(insertSlice).toMatch(/\(user_id, endpoint, p256dh, auth, user_agent, last_seen_at\)/i);
    // Caller-supplied params, not user_id from input.
    expect(insertSlice).toMatch(/values\s*\(\s*v_uid/i);
  });

  it("revokes from public and grants execute to authenticated", () => {
    expect(SQL).toMatch(
      /revoke all on function public\.claim_web_push_subscription\(text, text, text, text\) from public/i,
    );
    expect(SQL).toMatch(
      /grant execute on function public\.claim_web_push_subscription\(text, text, text, text\) to authenticated/i,
    );
  });
});

describe("subscribeToWebPush client wires the RPC", () => {
  const TS = readFileSync(
    resolve(process.cwd(), "src/lib/push/webNotifications.ts"),
    "utf-8",
  );

  it("calls supabase.rpc('claim_web_push_subscription', ...)", () => {
    expect(TS).toMatch(/supabase\.rpc\(\s*"claim_web_push_subscription"/);
  });

  it("passes p_endpoint / p_p256dh / p_auth / p_user_agent (not user_id; server derives from auth.uid())", () => {
    expect(TS).toMatch(/p_endpoint:\s*payload\.endpoint/);
    expect(TS).toMatch(/p_p256dh:\s*payload\.keys\.p256dh/);
    expect(TS).toMatch(/p_auth:\s*payload\.keys\.auth/);
    expect(TS).toMatch(/p_user_agent:/);
  });

  it("falls back to the legacy upsert path on 42883 (function-not-found)", () => {
    // Migration may lag behind a deploy in dev; the fallback keeps
    // users subscribable. Pin its presence so a future cleanup that
    // removes it has to acknowledge the rollout state.
    expect(TS).toMatch(/42883/);
    expect(TS).toMatch(/onConflict:\s*"endpoint"/);
  });
});
