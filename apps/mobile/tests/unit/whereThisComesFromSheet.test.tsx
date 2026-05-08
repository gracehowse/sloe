/**
 * Pattern #9 (`AN8GJ1Dr3M`, 2026-05-08) — pin the WhereThisComesFromSheet's
 * `formatLastSynced` helper. The sheet's value relies on it formatting an
 * AsyncStorage timestamp into "X min ago" / "Yesterday at HH:MM" / a
 * graceful fallback when missing.
 */
import { describe, it, expect } from "vitest";
import { formatLastSynced } from "../../components/today/WhereThisComesFromSheet";

describe("Pattern #9 — formatLastSynced", () => {
  const NOW = new Date("2026-05-08T12:00:00").getTime();

  it("falls back to 'Synced recently' when missing / invalid", () => {
    expect(formatLastSynced(null, NOW)).toBe("Synced recently");
    expect(formatLastSynced(0, NOW)).toBe("Synced recently");
    expect(formatLastSynced(NaN, NOW)).toBe("Synced recently");
    expect(formatLastSynced(-100, NOW)).toBe("Synced recently");
  });

  it("'Just now' for ages under 60s", () => {
    expect(formatLastSynced(NOW - 1_000, NOW)).toBe("Just now");
    expect(formatLastSynced(NOW - 30_000, NOW)).toBe("Just now");
    expect(formatLastSynced(NOW - 59_000, NOW)).toBe("Just now");
  });

  it("'X min ago' for ages 1–59 minutes", () => {
    expect(formatLastSynced(NOW - 60_000, NOW)).toBe("1 min ago");
    expect(formatLastSynced(NOW - 4 * 60_000, NOW)).toBe("4 min ago");
    expect(formatLastSynced(NOW - 59 * 60_000, NOW)).toBe("59 min ago");
  });

  it("'X hour(s) ago' for 1–23 hours", () => {
    expect(formatLastSynced(NOW - 60 * 60_000, NOW)).toBe("1 hour ago");
    expect(formatLastSynced(NOW - 5 * 60 * 60_000, NOW)).toBe("5 hours ago");
  });

  it("'Yesterday at HH:MM' for 24h+ but same calendar yesterday", () => {
    const yesterdayAt8am = new Date("2026-05-07T08:00:00").getTime();
    const out = formatLastSynced(yesterdayAt8am, NOW);
    expect(out.startsWith("Yesterday at")).toBe(true);
  });

  it("'Mon DD, HH:MM' for older dates", () => {
    const fiveDaysAgo = new Date("2026-05-03T08:00:00").getTime();
    const out = formatLastSynced(fiveDaysAgo, NOW);
    // Locale-dependent format; just assert it's not the bare "Synced
    // recently" fallback and contains a digit (year/day) somewhere.
    expect(out).not.toBe("Synced recently");
    expect(/\d/.test(out)).toBe(true);
  });
});
