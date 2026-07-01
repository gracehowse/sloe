import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SQL = readFileSync(
  resolve(
    __dirname,
    "../../supabase/migrations/20260701103000_eng1236_referral_reward_loop.sql",
  ),
  "utf8",
);

describe("ENG-1236 referral reward migration", () => {
  it("creates the referral code and redemption ledger tables", () => {
    expect(SQL).toMatch(/create\s+table\s+if\s+not\s+exists\s+public\.referrals/i);
    expect(SQL).toMatch(/create\s+table\s+if\s+not\s+exists\s+public\.referral_credits/i);
    expect(SQL).toMatch(/referrer_days\s+integer\s+not\s+null\s+default\s+30/i);
    expect(SQL).toMatch(/referee_days\s+integer\s+not\s+null\s+default\s+30/i);
  });

  it("prevents duplicate invitee redemption and self-referral", () => {
    expect(SQL).toMatch(/referral_credits_referee_id_unique/i);
    expect(SQL).toMatch(/v_referral\.referrer_id\s*=\s*v_uid/i);
    expect(SQL).toMatch(/regexp_replace\(upper\(coalesce\(p_code,\s*''\)\),\s*'\[\^A-Z0-9\]'/i);
    expect(SQL).toMatch(/exception\s+when\s+unique_violation[\s\S]*'already_redeemed'/i);
    expect(SQL).toContain("'cannot_refer_self'");
    expect(SQL).toContain("'already_redeemed'");
  });

  it("keeps writes behind security definer RPCs", () => {
    expect(SQL).toMatch(/function\s+public\.get_or_create_referral_code\(\)[\s\S]*security\s+definer/i);
    expect(SQL).toMatch(/function\s+public\.redeem_referral_code\(p_code\s+text\)[\s\S]*security\s+definer/i);
    expect(SQL).toMatch(/grant\s+execute\s+on\s+function\s+public\.redeem_referral_code\(text\)\s+to\s+authenticated/i);
  });
});
