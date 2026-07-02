/**
 * @vitest-environment node
 *
 * ENG-1320 — referral migration drift reconciliation + fraud controls
 * (ENG-1236 fast-follow). One test per guard:
 *
 *   Drift  reward_granted_at nullable/no-default, FKs → auth.users(id),
 *          no_self_referral CHECK in the lineage, index dedupe + the
 *          canonical upper(code) unique index.
 *   F1     per-referrer reward cap (10 rewarded redemptions, then 0 days).
 *   F2     24h velocity throttle (5/24h → auto-flag + rate_limited).
 *   F3     alias self-referral guard via normalised-email identity.
 *   F4     row lock + CHECK backstop against concurrent/self redemption.
 *   F5     table-grant lockdown (writes only via SECURITY DEFINER RPCs,
 *          authenticated keeps SELECT for ReferralRewardCard).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260702126200_eng1320_referral_drift_and_fraud_controls.sql";
const sql = readFileSync(resolve(process.cwd(), migrationPath), "utf8");
const normalized = sql.replace(/\s+/g, " ");
// Executable statements only — SQL comments stripped:
const code = sql.replace(/--[^\n]*/g, "").replace(/\s+/g, " ");

function redeemBody(): string {
  const start = normalized.indexOf(
    "create or replace function public.redeem_referral_code",
  );
  const end = normalized.indexOf(
    "comment on function public.redeem_referral_code",
  );
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return normalized.slice(start, end);
}

describe("ENG-1320 drift reconciliation", () => {
  it("converges reward_granted_at onto nullable with no default (live wins)", () => {
    expect(normalized).toContain(
      "alter table public.referral_credits alter column reward_granted_at drop default;",
    );
    expect(normalized).toContain(
      "alter table public.referral_credits alter column reward_granted_at drop not null;",
    );
  });

  it("re-points all three FKs at auth.users(id), never public.profiles", () => {
    for (const constraint of [
      "referrals_referrer_id_fkey",
      "referral_credits_referrer_id_fkey",
      "referral_credits_referee_id_fkey",
    ]) {
      expect(normalized).toContain(`drop constraint if exists ${constraint};`);
      expect(normalized).toMatch(
        new RegExp(
          `add constraint ${constraint} foreign key \\([a-z_]+\\) references auth\\.users\\(id\\) on delete cascade;`,
        ),
      );
    }
    expect(normalized).not.toContain("references public.profiles");
  });

  it("adds the live no_self_referral CHECK to the migration lineage idempotently", () => {
    expect(normalized).toMatch(
      /if not exists \( select 1 from pg_constraint where conrelid = 'public\.referral_credits'::regclass and conname = 'no_self_referral' \)/,
    );
    expect(normalized).toContain(
      "add constraint no_self_referral check (referrer_id <> referee_id);",
    );
  });

  it("dedupes the live-only duplicate indexes and converges on one upper(code) unique index", () => {
    expect(normalized).toContain(
      "alter table public.referral_credits drop constraint if exists unique_referee;",
    );
    expect(normalized).toContain(
      "drop index if exists public.referral_credits_referrer_idx;",
    );
    expect(normalized).toContain(
      "alter table public.referrals drop constraint if exists referrals_referrer_unique;",
    );
    // Same name, two different live/fresh objects — both must go:
    expect(normalized).toContain(
      "alter table public.referrals drop constraint if exists referrals_code_unique;",
    );
    expect(normalized).toContain(
      "drop index if exists public.referrals_code_unique;",
    );
    expect(normalized).toContain(
      "create unique index if not exists referrals_code_upper_unique on public.referrals (upper(code));",
    );
  });
});

describe("ENG-1320 F1 — per-referrer reward cap", () => {
  it("stops rewarding the referrer after 10 rewarded redemptions but still pays the referee", () => {
    const body = redeemBody();
    expect(body).toContain("v_referrer_days integer := 30;");
    expect(body).toMatch(
      /select count\(\*\) into v_rewarded_redemptions from public\.referral_credits where referrer_id = v_referral\.referrer_id and referrer_days > 0;/,
    );
    expect(body).toMatch(
      /if v_rewarded_redemptions >= 10 then v_referrer_days := 0; end if;/,
    );
    // Insert pays the capped referrer amount and the fixed referee 30:
    expect(body).toMatch(/values \( v_code, v_referral\.referrer_id, v_uid, v_referrer_days, 30 \)/);
  });
});

describe("ENG-1320 F2 — velocity throttle", () => {
  it("flags the code and rejects on a 6th redemption inside 24h", () => {
    const body = redeemBody();
    expect(body).toMatch(
      /select count\(\*\) into v_recent_redemptions from public\.referral_credits where referrer_id = v_referral\.referrer_id and redeemed_at > now\(\) - interval '24 hours';/,
    );
    expect(body).toContain("if v_recent_redemptions >= 5 then");
    expect(body).toMatch(
      /update public\.referrals set flagged_at = now\(\), flagged_reason = 'auto: ' \|\| v_recent_redemptions \|\| ' redemptions in 24h/,
    );
    expect(body).toContain("'rate_limited'");
  });

  it("keeps flagged codes from redeeming at all", () => {
    expect(redeemBody()).toContain("and flagged_at is null");
  });
});

describe("ENG-1320 F3 — alias self-referral guard", () => {
  it("normalises +tags everywhere and dots/googlemail for Gmail", () => {
    const start = normalized.indexOf(
      "create or replace function public.referral_email_identity",
    );
    const end = normalized.indexOf(
      "comment on function public.referral_email_identity",
    );
    expect(start).toBeGreaterThan(-1);
    const fn = normalized.slice(start, end);
    expect(fn).toContain("immutable");
    expect(fn).toContain("set search_path = ''");
    // +tag stripped for every domain:
    expect(fn).toContain("regexp_replace(local_part, '\\+.*$', '')");
    // Gmail additionally folds dots and googlemail → gmail:
    expect(fn).toContain(
      "when domain in ('gmail.com', 'googlemail.com') then replace(regexp_replace(local_part, '\\+.*$', ''), '.', '')",
    );
    expect(fn).toContain(
      "case when domain = 'googlemail.com' then 'gmail.com' else domain end",
    );
  });

  it("keeps the helper internal — no client EXECUTE", () => {
    expect(normalized).toContain(
      "revoke execute on function public.referral_email_identity(text) from public, anon, authenticated;",
    );
  });

  it("rejects a normalised-email match as cannot_refer_self", () => {
    const body = redeemBody();
    expect(body).toMatch(
      /public\.referral_email_identity\(v_referrer_email\) = public\.referral_email_identity\(v_referee_email\)/,
    );
    const aliasGuard = body.indexOf("referral_email_identity(v_referrer_email)");
    const verdict = body.indexOf("'cannot_refer_self'", aliasGuard);
    expect(verdict).toBeGreaterThan(aliasGuard);
  });
});

describe("ENG-1320 F4 — race + self-referral backstops", () => {
  it("locks the referral row so concurrent redemptions serialise through F1/F2", () => {
    expect(redeemBody()).toMatch(/limit 1 for update;/);
  });

  it("guards direct id self-referral before the alias guard", () => {
    const body = redeemBody();
    expect(body).toMatch(
      /if v_referral\.referrer_id = v_uid then return jsonb_build_object\('status', 'cannot_refer_self'\);/,
    );
  });

  it("maps the CHECK backstop and duplicate-referee races to stable statuses", () => {
    const body = redeemBody();
    expect(body).toMatch(/when unique_violation then return jsonb_build_object\('status', 'already_redeemed'\);/);
    expect(body).toMatch(/when check_violation then/);
    expect(body).toContain("'cannot_refer_self'");
  });

  it("still refuses unauthenticated and blank-code calls", () => {
    const body = redeemBody();
    expect(body).toMatch(/if v_uid is null then return jsonb_build_object\('status', 'not_authenticated'\);/);
    expect(body).toMatch(/if v_code = '' then return jsonb_build_object\('status', 'invalid_code'\);/);
  });

  it("stays SECURITY DEFINER with a pinned search_path", () => {
    const body = redeemBody();
    expect(body).toContain("security definer");
    expect(body).toContain("set search_path = public, pg_temp");
  });
});

describe("ENG-1320 F5 — table-grant lockdown", () => {
  it("revokes everything from anon and all writes from authenticated", () => {
    expect(normalized).toContain("revoke all on table public.referrals from anon;");
    expect(normalized).toContain(
      "revoke all on table public.referral_credits from anon;",
    );
    expect(normalized).toContain(
      "revoke insert, update, delete, truncate, references, trigger on table public.referrals from authenticated;",
    );
    expect(normalized).toContain(
      "revoke insert, update, delete, truncate, references, trigger on table public.referral_credits from authenticated;",
    );
  });

  it("keeps authenticated SELECT (the RLS select-own read surface) and grants anon nothing", () => {
    expect(code).not.toMatch(/revoke[^;]*\bselect\b[^;]*from authenticated/);
    expect(code).not.toMatch(/grant[^;]*to[^;]*\banon\b/);
  });
});
