/**
 * P0-6 (2026-04-25) — pin the rate-limit bucket-key composition so
 * future regressions (dropping the user prefix, flattening the
 * namespace, accidentally re-IP-only-ing the helper) fail at PR time.
 *
 * Bucket key contract:
 *   - With `userId` set:  `${keyPrefix}:user:${userId}:${ip}`
 *   - Without (anon):     `${keyPrefix}:anon:${ip}`
 *
 * Pre-fix the helper composed `${keyPrefix}:${ip}` only — a single
 * shared NAT could starve every legitimate user behind that IP, and an
 * IP-rotating attacker could bypass the cap entirely while still
 * targeting a specific user.
 */
import { describe, expect, it } from "vitest";
import { _composeRateLimitKeyForTest } from "../../src/lib/server/rateLimit";

describe("_composeRateLimitKeyForTest — bucket key contract", () => {
  it("composes user:<uid>:<ip> when userId is supplied", () => {
    expect(
      _composeRateLimitKeyForTest({ keyPrefix: "api:photo-log", userId: "abc-123" }, "1.2.3.4"),
    ).toBe("api:photo-log:user:abc-123:1.2.3.4");
  });

  it("composes anon:<ip> when userId is omitted", () => {
    expect(
      _composeRateLimitKeyForTest({ keyPrefix: "api:public" }, "1.2.3.4"),
    ).toBe("api:public:anon:1.2.3.4");
  });

  it("treats null and empty userId as anonymous (back-compat)", () => {
    expect(
      _composeRateLimitKeyForTest({ keyPrefix: "api:foo", userId: null }, "1.2.3.4"),
    ).toBe("api:foo:anon:1.2.3.4");
    expect(
      _composeRateLimitKeyForTest({ keyPrefix: "api:foo", userId: "" }, "1.2.3.4"),
    ).toBe("api:foo:anon:1.2.3.4");
  });

  it("isolates buckets across (user, IP) tuples", () => {
    const a = _composeRateLimitKeyForTest({ keyPrefix: "api:x", userId: "alice" }, "1.1.1.1");
    const b = _composeRateLimitKeyForTest({ keyPrefix: "api:x", userId: "alice" }, "2.2.2.2");
    const c = _composeRateLimitKeyForTest({ keyPrefix: "api:x", userId: "bob" }, "1.1.1.1");
    expect(a).not.toBe(b); // same user, different IP → different bucket
    expect(a).not.toBe(c); // same IP, different user → different bucket
    expect(b).not.toBe(c);
  });
});

/**
 * ENG-1490 finding #5 (2026-07-10) — `identityScoped` opt-in.
 *
 * The default (user, ip) composite key above is CORRECT for abuse
 * throttles and is left completely unchanged — every test in the
 * describe block above asserts that with no `identityScoped` field at
 * all, which is the strongest signal the default path is untouched.
 *
 * `identityScoped: true` is an opt-in for identity-BOUND entitlement
 * quotas (e.g. "5 free AI photo logs a week") where the cap is a property
 * of the account, not the connection — a genuine client IP change (mobile
 * CGNAT rotation, VPN) must not reset it.
 */
describe("_composeRateLimitKeyForTest — identityScoped opt-in (ENG-1490 #5)", () => {
  it("identityScoped + userId: drops the IP component entirely", () => {
    expect(
      _composeRateLimitKeyForTest(
        { keyPrefix: "api:photo-log:free-quota", userId: "abc-123", identityScoped: true },
        "1.2.3.4",
      ),
    ).toBe("api:photo-log:free-quota:user:abc-123");
  });

  it("identityScoped + userId: same bucket regardless of IP (the actual bypass this closes)", () => {
    const a = _composeRateLimitKeyForTest(
      { keyPrefix: "api:x:free-quota", userId: "alice", identityScoped: true },
      "1.1.1.1",
    );
    const b = _composeRateLimitKeyForTest(
      { keyPrefix: "api:x:free-quota", userId: "alice", identityScoped: true },
      "9.9.9.9",
    );
    expect(a).toBe(b);
  });

  it("identityScoped: true but userId omitted falls back to the anon:ip shape (unaffected — nothing to identity-scope)", () => {
    expect(
      _composeRateLimitKeyForTest({ keyPrefix: "api:public", identityScoped: true }, "1.2.3.4"),
    ).toBe("api:public:anon:1.2.3.4");
  });

  it("identityScoped omitted (default) is byte-identical to the pre-ENG-1490 composite key", () => {
    expect(
      _composeRateLimitKeyForTest({ keyPrefix: "api:photo-log", userId: "abc-123" }, "1.2.3.4"),
    ).toBe("api:photo-log:user:abc-123:1.2.3.4");
  });

  it("identityScoped: false is byte-identical to omitted (explicit opt-out is a no-op)", () => {
    expect(
      _composeRateLimitKeyForTest(
        { keyPrefix: "api:photo-log", userId: "abc-123", identityScoped: false },
        "1.2.3.4",
      ),
    ).toBe("api:photo-log:user:abc-123:1.2.3.4");
  });
});
