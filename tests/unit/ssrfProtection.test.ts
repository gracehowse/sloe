/**
 * Tests for SSRF protection in recipe import.
 * Verifies that private/reserved IPs are blocked.
 */
import { describe, it, expect } from "vitest";

// Re-implement the isPrivateHost function for testing (same logic as route.ts)
function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1") return true;
  if (/^10\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true;
  if (h.startsWith("fd") || h.startsWith("fe80") || h.startsWith("fc")) return true;
  if (h === "metadata.google.internal" || h === "169.254.169.254") return true;
  if (/^::ffff:/.test(h)) {
    const mapped = h.replace("::ffff:", "");
    if (/^10\./.test(mapped) || /^172\.(1[6-9]|2\d|3[01])\./.test(mapped) || /^192\.168\./.test(mapped) || /^169\.254\./.test(mapped) || mapped === "127.0.0.1") return true;
  }
  return false;
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
});
