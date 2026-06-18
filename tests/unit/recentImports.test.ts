/**
 * ENG-898 — shared recent-imports mapping + fetch contract.
 */
import { describe, expect, it, vi } from "vitest";
import {
  fetchRecentImports,
  formatRecentImportRelativeTime,
  mapRecipeRowsToRecentImports,
  mapSourceNameToRecentImportSource,
  recentImportMonogram,
} from "../../src/lib/recipes/recentImports";

describe("recentImports (ENG-898)", () => {
  it("maps source names to platform buckets", () => {
    expect(mapSourceNameToRecentImportSource("TikTok")).toBe("tiktok");
    expect(mapSourceNameToRecentImportSource("instagram.com")).toBe("instagram");
    expect(mapSourceNameToRecentImportSource("YouTube")).toBe("youtube");
    expect(mapSourceNameToRecentImportSource("Example Kitchen")).toBe("web");
  });

  it("formats relative time labels", () => {
    const now = Date.parse("2026-06-17T12:00:00.000Z");
    expect(formatRecentImportRelativeTime("2026-06-17T08:00:00.000Z", now)).toBe("Today");
    expect(formatRecentImportRelativeTime("2026-06-16T08:00:00.000Z", now)).toBe("Yesterday");
    expect(formatRecentImportRelativeTime("2026-06-14T08:00:00.000Z", now)).toBe("3 days ago");
  });

  it("maps recipe rows to recent import items", () => {
    const now = Date.parse("2026-06-17T12:00:00.000Z");
    expect(
      mapRecipeRowsToRecentImports(
        [
          {
            title: "Sheet-Pan Fajitas",
            source_name: "TikTok",
            created_at: "2026-06-17T08:00:00.000Z",
          },
        ],
        now,
      ),
    ).toEqual([{ name: "Sheet-Pan Fajitas", source: "tiktok", time: "Today" }]);
  });

  it("uses monograms TT/IG/YT/W", () => {
    expect(recentImportMonogram("tiktok")).toBe("TT");
    expect(recentImportMonogram("instagram")).toBe("IG");
    expect(recentImportMonogram("youtube")).toBe("YT");
    expect(recentImportMonogram("web")).toBe("W");
  });

  it("fetchRecentImports queries imported recipes for the author", async () => {
    const limit = vi.fn().mockResolvedValue({
      data: [
        {
          title: "Pasta",
          source_name: "Instagram",
          created_at: "2026-06-17T08:00:00.000Z",
        },
      ],
    });
    const order = vi.fn(() => ({ limit }));
    const not = vi.fn(() => ({ order }));
    const eq = vi.fn(() => ({ not }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));

    const rows = await fetchRecentImports({ from } as never, "user-1");

    expect(from).toHaveBeenCalledWith("recipes");
    expect(select).toHaveBeenCalledWith("title, source_name, created_at");
    expect(eq).toHaveBeenCalledWith("author_id", "user-1");
    expect(not).toHaveBeenCalledWith("source_url", "is", null);
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(limit).toHaveBeenCalledWith(3);
    expect(rows[0]?.name).toBe("Pasta");
    expect(rows[0]?.source).toBe("instagram");
  });
});
