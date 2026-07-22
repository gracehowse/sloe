import { describe, expect, it } from "vitest";
import {
  formatMealShareDate,
  mealShareViewState,
  mealShareViewStateLabel,
  mealSharedLinksCountLabel,
  parseMealShareRow,
} from "@/lib/share/mealSharedLinks";

describe("mealShareViewState", () => {
  const now = new Date("2026-07-22T12:00:00Z");

  it("returns revoked when revokedAt is set", () => {
    expect(
      mealShareViewState(
        {
          revokedAt: "2026-07-21T00:00:00Z",
          expiresAt: "2026-08-21T00:00:00Z",
        },
        now,
      ),
    ).toBe("revoked");
  });

  it("returns expired when expiresAt is in the past", () => {
    expect(
      mealShareViewState(
        { revokedAt: null, expiresAt: "2026-07-20T00:00:00Z" },
        now,
      ),
    ).toBe("expired");
  });

  it("returns active when not revoked and not expired", () => {
    expect(
      mealShareViewState(
        { revokedAt: null, expiresAt: "2026-08-21T00:00:00Z" },
        now,
      ),
    ).toBe("active");
  });
});

describe("mealShareViewStateLabel", () => {
  it("labels each state", () => {
    expect(mealShareViewStateLabel("active")).toBe("Active");
    expect(mealShareViewStateLabel("expired")).toBe("Expired");
    expect(mealShareViewStateLabel("revoked")).toBe("Revoked");
  });
});

describe("mealSharedLinksCountLabel", () => {
  it("formats zero/one/many", () => {
    expect(mealSharedLinksCountLabel(0)).toBe("No shared meal links");
    expect(mealSharedLinksCountLabel(1)).toBe("1 shared meal link");
    expect(mealSharedLinksCountLabel(3)).toBe("3 shared meal links");
  });
});

describe("parseMealShareRow", () => {
  it("parses a valid row", () => {
    expect(
      parseMealShareRow({
        id: "id-1",
        token: "a".repeat(32),
        title: "Lunch salad",
        meal_slot: "Lunch",
        created_at: "2026-07-22T09:00:00Z",
        expires_at: "2026-08-21T09:00:00Z",
        revoked_at: null,
      }),
    ).toEqual({
      id: "id-1",
      token: "a".repeat(32),
      title: "Lunch salad",
      mealSlot: "Lunch",
      createdAt: "2026-07-22T09:00:00Z",
      expiresAt: "2026-08-21T09:00:00Z",
      revokedAt: null,
    });
  });

  it("returns null for malformed rows", () => {
    expect(parseMealShareRow({ id: "x" })).toBeNull();
    expect(parseMealShareRow(null)).toBeNull();
  });
});

describe("formatMealShareDate", () => {
  it("returns em dash for invalid dates", () => {
    expect(formatMealShareDate("not-a-date")).toBe("—");
  });

  it("formats valid ISO dates", () => {
    const formatted = formatMealShareDate("2026-07-22T09:00:00Z", "en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
    expect(formatted).toContain("2026");
  });
});
