/**
 * Icon-strategy emoji → Lucide swap, gated behind `design_system_icons`
 * (P5 parity worklist gaps #10 / #23 / #24; ENG-816).
 *
 * `docs/decisions/2026-05-31-icon-strategy.md` bans functional emoji at the
 * premium bar — they render differently per OS/font. Three web surfaces
 * still shipped emoji as functional UI glyphs:
 *   - #10 HydrationStimulantsCard rows: 💧/☕/🍷 → lucide Droplet/Coffee/Wine
 *   - #23 PhotoLogDialog "Plate total" banner: 👉 → lucide ArrowRight
 *   - #24 CreatorRecipeList missing-thumbnail: 🍳 → canonical RecipeHeroFallback
 *
 * The Hydration and CreatorRecipeList swaps are gated behind
 * `design_system_icons` with the emoji kept alive in the `else` (CLAUDE.md
 * feature-flag rule); their tests pin BOTH states (flag ON → Lucide present,
 * emoji gone; flag OFF → emoji present, Lucide absent) so a refactor can't
 * silently drop the swap or re-introduce the emoji. The PhotoLogDialog "Plate
 * total" arrow is the EXCEPTION — it is ungated (ENG-816 #24) to match mobile
 * PhotoLogSheet, which has rendered ArrowRight unconditionally since
 * 2026-05-06; its two cases assert the arrow in BOTH flag states.
 *
 * Mobile parity: mobile renders the lucide glyphs on the equivalent
 * surfaces (PhotoLogSheet `ArrowRight`, RecipeHeroFallback canonical
 * fallback); the paired mobile HydrationStimulantsCard swap tracks under
 * ENG-816.
 */
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

void React;

// Flag gate — flipped per-test. Default OFF so the emoji path renders
// unless a test opts in.
const isFeatureEnabled = vi.fn((_flag: string) => false);
vi.mock("../../src/lib/analytics/track", () => ({
  isFeatureEnabled: (...args: [string]) => isFeatureEnabled(...args),
  track: vi.fn(),
}));
// photo-log-dialog imports the same module via a `.ts` specifier in one of
// its transitive deps; alias both spellings to the same mock.
vi.mock("../../src/lib/analytics/track.ts", () => ({
  isFeatureEnabled: (...args: [string]) => isFeatureEnabled(...args),
  track: vi.fn(),
}));

vi.mock("../../src/lib/supabase/browserClient", () => ({
  supabase: {
    auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            order: () => ({
              range: () => ({ returns: () => Promise.resolve({ data: [], error: null }) }),
            }),
          }),
          ilike: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    }),
  },
}));

vi.mock("../../src/lib/nutrition/photoCorrectionPersist", () => ({
  persistPhotoCorrections: vi.fn(async () => ({ anyPersisted: false })),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { HydrationStimulantsCard } from "../../src/app/components/suppr/hydration-stimulants-card";
import { CreatorRecipeList } from "../../src/app/components/creator/CreatorRecipeList";
import { PhotoLogDialog } from "../../src/app/components/suppr/photo-log-dialog";

beforeEach(() => {
  isFeatureEnabled.mockReturnValue(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const HYDRATION_PROPS = {
  selectedDateKey: "2026-05-31",
  weekStartDay: "monday" as const,
  targets: { waterMl: 2000, caffeineMg: 400, alcoholGWeekly: 100 },
  waterTotalMl: 500,
  waterFromMealsMl: 0,
  caffeineTotalMg: 80,
  alcoholByDayG: {},
  measurementSystem: "metric" as const,
  onAddWater: vi.fn(),
  onAddCaffeine: vi.fn(),
  onAddAlcohol: vi.fn(),
  onReset: vi.fn(),
};

describe("HydrationStimulantsCard icons (gap #10)", () => {
  it("flag ON: renders Droplet / Coffee / Wine lucide glyphs and no emoji", () => {
    isFeatureEnabled.mockReturnValue(true);
    const { container } = render(<HydrationStimulantsCard {...HYDRATION_PROPS} />);
    expect(container.querySelector(".lucide-droplet")).not.toBeNull();
    expect(container.querySelector(".lucide-coffee")).not.toBeNull();
    expect(container.querySelector(".lucide-wine")).not.toBeNull();
    // Functional emoji must be gone.
    expect(container.textContent).not.toContain("💧");
    expect(container.textContent).not.toContain("☕");
    expect(container.textContent).not.toContain("🍷");
  });

  it("flag OFF: keeps the emoji path alive and renders no lucide glyphs", () => {
    isFeatureEnabled.mockReturnValue(false);
    const { container } = render(<HydrationStimulantsCard {...HYDRATION_PROPS} />);
    expect(container.textContent).toContain("💧");
    expect(container.textContent).toContain("☕");
    expect(container.textContent).toContain("🍷");
    expect(container.querySelector(".lucide-droplet")).toBeNull();
    expect(container.querySelector(".lucide-coffee")).toBeNull();
    expect(container.querySelector(".lucide-wine")).toBeNull();
  });

  it("flag ON: each glyph is tinted with its tone colour token", () => {
    isFeatureEnabled.mockReturnValue(true);
    const { container } = render(<HydrationStimulantsCard {...HYDRATION_PROPS} />);
    const droplet = container.querySelector(".lucide-droplet") as SVGElement | null;
    const coffee = container.querySelector(".lucide-coffee") as SVGElement | null;
    const wine = container.querySelector(".lucide-wine") as SVGElement | null;
    expect(droplet?.getAttribute("style")).toContain("var(--macro-water)");
    expect(coffee?.getAttribute("style")).toContain("var(--stimulant-caffeine)");
    expect(wine?.getAttribute("style")).toContain("var(--stimulant-alcohol)");
  });
});

describe("CreatorRecipeList missing-thumbnail (gap #24)", () => {
  const ROW = {
    id: "rec-1",
    title: "Sheet-pan chicken",
    image_url: null,
    calories: 520,
    protein: 38,
    carbs: 30,
    cook_time_min: 25,
    prep_time_min: 10,
  };

  it("flag ON: renders the canonical RecipeHeroFallback (no 🍳 emoji)", () => {
    isFeatureEnabled.mockReturnValue(true);
    const { container } = render(
      <CreatorRecipeList creatorId="c-1" initialRecipes={[ROW]} initialHasMore={false} />,
    );
    expect(container.querySelector('[data-testid="recipe-hero-fallback-rec-1"]')).not.toBeNull();
    expect(container.textContent).not.toContain("🍳");
  });

  it("flag OFF: keeps the 🍳 emoji placeholder alive (no fallback)", () => {
    isFeatureEnabled.mockReturnValue(false);
    const { container } = render(
      <CreatorRecipeList creatorId="c-1" initialRecipes={[ROW]} initialHasMore={false} />,
    );
    expect(container.textContent).toContain("🍳");
    expect(container.querySelector('[data-testid="recipe-hero-fallback-rec-1"]')).toBeNull();
  });

  it("renders the real image when image_url is present (no placeholder either way)", () => {
    isFeatureEnabled.mockReturnValue(true);
    const { container } = render(
      <CreatorRecipeList
        creatorId="c-1"
        initialRecipes={[{ ...ROW, image_url: "https://img.example/r.jpg" }]}
        initialHasMore={false}
      />,
    );
    expect(container.querySelector("img")).not.toBeNull();
    expect(container.querySelector('[data-testid="recipe-hero-fallback-rec-1"]')).toBeNull();
    expect(container.textContent).not.toContain("🍳");
  });
});

describe("PhotoLogDialog plate-total glyph (gap #23)", () => {
  const FIXTURE_RESPONSE = {
    ok: true,
    modelVersion: "gpt-4o-test",
    items: [
      {
        id: "ai-pita",
        name: "Pita",
        category: "Bread + dips",
        quantityHint: "1 piece",
        calories: { low: 120, high: 150 },
        protein: null,
        carbs: null,
        fat: null,
        confidence: "high" as const,
        source: "ai" as const,
      },
    ],
    addons: [],
    totalKcal: { low: 120, high: 150 },
    totalKcalWithAddons: { low: 120, high: 150 },
    notes: null,
  };

  function stubAnalyse() {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(FIXTURE_RESPONSE), { status: 200 })),
    );
    if (typeof URL.createObjectURL !== "function") {
      Object.defineProperty(URL, "createObjectURL", { value: vi.fn(() => "blob:test"), writable: true });
    }
    if (typeof URL.revokeObjectURL !== "function") {
      Object.defineProperty(URL, "revokeObjectURL", { value: vi.fn(), writable: true });
    }
  }

  async function renderAnalysed() {
    stubAnalyse();
    render(
      <PhotoLogDialog open onOpenChange={vi.fn()} activeSlot="Lunch" onCommit={vi.fn()} />,
    );
    const file = new File([new Uint8Array([1, 2, 3])], "meal.png", { type: "image/png" });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();
    fireEvent.change(fileInput!, { target: { files: [file] } });
    const analyse = await screen.findByRole("button", { name: /analyse/i });
    fireEvent.click(analyse);
    return screen.findByTestId("photo-log-plate-total");
  }

  // ENG-816 #24: the Plate-total arrow is UNGATED, unlike the other swaps in
  // this suite. Mobile PhotoLogSheet has rendered ArrowRight unconditionally
  // since the 2026-05-06 F-107 audit, so gating only web left web on 👉 while
  // mobile showed the glyph. It now renders regardless of `design_system_icons`
  // for day-one parity; these two cases pin that it never reverts to 👉.
  it("Plate total banner leads with a lucide ArrowRight, not 👉 (flag ON)", async () => {
    isFeatureEnabled.mockReturnValue(true);
    const banner = await renderAnalysed();
    expect(banner.querySelector(".lucide-arrow-right")).not.toBeNull();
    expect(banner.textContent).not.toContain("👉");
    expect(banner.textContent).toMatch(/Plate total/);
  });

  it("Plate total banner keeps the ArrowRight with design_system_icons OFF (ungated, mobile parity)", async () => {
    isFeatureEnabled.mockReturnValue(false);
    const banner = await renderAnalysed();
    expect(banner.querySelector(".lucide-arrow-right")).not.toBeNull();
    expect(banner.textContent).not.toContain("👉");
    expect(banner.textContent).toMatch(/Plate total/);
  });
});
