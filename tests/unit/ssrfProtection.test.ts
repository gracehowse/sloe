/**
 * Tests for SSRF protection in recipe import.
 * Verifies that private/reserved IPs are blocked and that DNS
 * pre-resolution (ENG-730) catches DNS-rebinding TOCTOU attempts.
 */
import { describe, it, expect } from "vitest";
// Import the REAL guard (no re-implementation — the prior copy could drift; ENG-682).
import { isPrivateHost, isAllowedUrl, resolveDnsAndValidate } from "@/lib/recipe-import/ssrfGuard";

/** Minimal stub for the injectable `_lookupFn` parameter. */
function stubLookup(records: { address: string; family: number }[]) {
  return async (_hostname: string, _opts: { all: true }) => records;
}

function failingLookup(message: string) {
  return async (_hostname: string, _opts: { all: true }): Promise<never> => {
    throw new Error(message);
  };
}

describe("SSRF isPrivateHost", () => {
  it("blocks localhost", () => {
    expect(isPrivateHost("localhost")).toBe(true);
    expect(isPrivateHost("127.0.0.1")).toBe(true);
    expect(isPrivateHost("::1")).toBe(true);
    expect(isPrivateHost("[::1]")).toBe(true);
  });

  it("blocks RFC 1918 private ranges", () => {
    expect(isPrivateHost("10.0.0.1")).toBe(true);
    expect(isPrivateHost("10.255.255.255")).toBe(true);
    expect(isPrivateHost("172.16.0.1")).toBe(true);
    expect(isPrivateHost("172.31.255.255")).toBe(true);
    expect(isPrivateHost("192.168.1.1")).toBe(true);
    expect(isPrivateHost("192.168.0.100")).toBe(true);
  });

  it("blocks link-local", () => {
    expect(isPrivateHost("169.254.1.1")).toBe(true);
    expect(isPrivateHost("169.254.169.254")).toBe(true);
  });

  it("blocks cloud metadata endpoints", () => {
    expect(isPrivateHost("metadata.google.internal")).toBe(true);
  });

  it("blocks IPv6 private", () => {
    expect(isPrivateHost("fd00::1")).toBe(true);
    expect(isPrivateHost("fe80::1")).toBe(true);
    expect(isPrivateHost("fc00::1")).toBe(true);
  });

  it("blocks IPv6-mapped IPv4 private addresses", () => {
    expect(isPrivateHost("::ffff:10.0.0.1")).toBe(true);
    expect(isPrivateHost("::ffff:192.168.1.1")).toBe(true);
    expect(isPrivateHost("::ffff:169.254.169.254")).toBe(true);
    expect(isPrivateHost("::ffff:127.0.0.1")).toBe(true);
  });

  it("allows public hostnames", () => {
    expect(isPrivateHost("example.com")).toBe(false);
    expect(isPrivateHost("8.8.8.8")).toBe(false);
    expect(isPrivateHost("1.1.1.1")).toBe(false);
    expect(isPrivateHost("halfbakedharvest.com")).toBe(false);
  });

  it("allows public IPv6", () => {
    expect(isPrivateHost("2001:db8::1")).toBe(false);
    expect(isPrivateHost("::ffff:8.8.8.8")).toBe(false);
  });

  it("rejects 172.16-31 but allows 172.15 and 172.32", () => {
    expect(isPrivateHost("172.15.0.1")).toBe(false);
    expect(isPrivateHost("172.16.0.1")).toBe(true);
    expect(isPrivateHost("172.31.0.1")).toBe(true);
    expect(isPrivateHost("172.32.0.1")).toBe(false);
  });

  it("blocks 0.0.0.0 and all-zeros literals (ENG-1152)", () => {
    expect(isPrivateHost("0.0.0.0")).toBe(true);
    expect(isPrivateHost("0")).toBe(true); // integer 0 → 0.0.0.0
    expect(isPrivateHost("::")).toBe(true);
    expect(isPrivateHost("[::]")).toBe(true);
  });

  it("blocks integer/hex/octal/short IPv4 encodings of localhost (ENG-1152)", () => {
    // 127.0.0.1 in alternate encodings
    expect(isPrivateHost("2130706433")).toBe(true); // decimal integer
    expect(isPrivateHost("0x7f000001")).toBe(true); // whole-value hex
    expect(isPrivateHost("017700000001")).toBe(true); // whole-value octal
    expect(isPrivateHost("0177.0.0.1")).toBe(true); // octal first octet
    expect(isPrivateHost("127.1")).toBe(true); // short form
    expect(isPrivateHost("127.0.0.2")).toBe(true); // loopback /8
  });

  it("blocks alternate encodings of private + link-local ranges (ENG-1152)", () => {
    expect(isPrivateHost("10.1")).toBe(true); // → 10.0.0.1
    expect(isPrivateHost("0xa.0.0.1")).toBe(true); // 10.0.0.1 via hex
    expect(isPrivateHost("2852039166")).toBe(true); // 169.254.169.254
  });

  it("does NOT false-positive public IP encodings (ENG-1152)", () => {
    expect(isPrivateHost("8.8.8.8")).toBe(false);
    expect(isPrivateHost("134744072")).toBe(false); // 8.8.8.8 as integer
    expect(isPrivateHost("0x08080808")).toBe(false); // 8.8.8.8 as hex
    expect(isPrivateHost("1.1.1.1")).toBe(false);
    expect(isPrivateHost("world.openfoodfacts.org")).toBe(false);
  });
});

describe("SSRF isAllowedUrl", () => {
  it("allows public http(s) URLs", () => {
    expect(isAllowedUrl("https://halfbakedharvest.com/recipe")).toBe(true);
    expect(isAllowedUrl("http://example.com")).toBe(true);
  });

  it("rejects private / metadata hosts", () => {
    expect(isAllowedUrl("http://169.254.169.254/latest/meta-data/")).toBe(false);
    expect(isAllowedUrl("http://127.0.0.1:8080/")).toBe(false);
    expect(isAllowedUrl("https://192.168.1.1/")).toBe(false);
    expect(isAllowedUrl("http://metadata.google.internal/")).toBe(false);
  });

  it("rejects non-http(s) schemes", () => {
    expect(isAllowedUrl("ftp://example.com/x")).toBe(false);
    expect(isAllowedUrl("file:///etc/passwd")).toBe(false);
    expect(isAllowedUrl("gopher://example.com")).toBe(false);
  });

  it("rejects malformed URLs", () => {
    expect(isAllowedUrl("not a url")).toBe(false);
    expect(isAllowedUrl("")).toBe(false);
  });
});

describe("SSRF resolveDnsAndValidate (ENG-730 DNS rebinding mitigation)", () => {
  it("resolves to a public IP — succeeds without throwing", async () => {
    await expect(
      resolveDnsAndValidate("example.com", stubLookup([{ address: "93.184.216.34", family: 4 }])),
    ).resolves.toBeUndefined();
  });

  it("throws when hostname resolves to a private IP (DNS rebinding simulation)", async () => {
    await expect(
      resolveDnsAndValidate("evil.attacker.com", stubLookup([{ address: "169.254.169.254", family: 4 }])),
    ).rejects.toThrow(/SSRF.*resolves to blocked address 169\.254\.169\.254/);
  });

  it("throws when ANY returned address is private (multi-answer rebinding)", async () => {
    await expect(
      resolveDnsAndValidate(
        "multi.attacker.com",
        stubLookup([
          { address: "93.184.216.34", family: 4 },
          { address: "10.0.0.1", family: 4 },
        ]),
      ),
    ).rejects.toThrow(/SSRF.*resolves to blocked address 10\.0\.0\.1/);
  });

  it("throws when DNS resolution fails (fail-closed behaviour)", async () => {
    await expect(
      resolveDnsAndValidate("notexist.example", failingLookup("ENOTFOUND")),
    ).rejects.toThrow(/SSRF: DNS lookup failed/);
  });

  it("throws when DNS returns no records", async () => {
    await expect(
      resolveDnsAndValidate("empty.example", stubLookup([])),
    ).rejects.toThrow(/SSRF: DNS returned no records/);
  });
});
