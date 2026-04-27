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
