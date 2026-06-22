/**
 * getTrustedClientIp (ENG-1226) — the client IP for rate-limiting + `reporter_ip`
 * audit must come from a header the client cannot forge. Pins that the
 * client-supplied LEFTMOST `x-forwarded-for` hop never wins, closing the
 * spam/poison gap on the DMCA + recipe-report queues.
 */
import { describe, expect, it } from "vitest";
import { getTrustedClientIp } from "../../src/lib/server/clientIp";

function headers(map: Record<string, string>) {
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(map)) lower[k.toLowerCase()] = v;
  return { get: (name: string) => lower[name.toLowerCase()] ?? null };
}

describe("getTrustedClientIp", () => {
  it("prefers the Vercel-injected IP over a forged x-forwarded-for", () => {
    const h = headers({
      "x-forwarded-for": "6.6.6.6, 10.0.0.1", // attacker-forged leftmost
      "x-vercel-forwarded-for": "203.0.113.9",
      "x-real-ip": "203.0.113.9",
    });
    expect(getTrustedClientIp(h)).toBe("203.0.113.9");
  });

  it("uses x-real-ip when there is no Vercel header (ignores forged XFF leftmost)", () => {
    const h = headers({
      "x-forwarded-for": "6.6.6.6",
      "x-real-ip": "198.51.100.7",
    });
    expect(getTrustedClientIp(h)).toBe("198.51.100.7");
  });

  it("falls back to the RIGHTMOST x-forwarded-for hop, never the forgeable leftmost", () => {
    // Self-host/dev: a trusted proxy appends the real client IP on the right;
    // the leftmost "6.6.6.6" is whatever the client sent and must be ignored.
    const h = headers({ "x-forwarded-for": "6.6.6.6, 70.0.0.2, 192.0.2.55" });
    expect(getTrustedClientIp(h)).toBe("192.0.2.55");
  });

  it("handles a single-hop x-forwarded-for", () => {
    expect(getTrustedClientIp(headers({ "x-forwarded-for": "127.0.0.1" }))).toBe("127.0.0.1");
  });

  it("returns null when no IP header is present (local dev)", () => {
    expect(getTrustedClientIp(headers({}))).toBeNull();
  });
});
