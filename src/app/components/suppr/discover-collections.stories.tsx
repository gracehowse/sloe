import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { RecipeCard } from "@/types/recipe";
import { DiscoverCollections } from "./discover-collections";

/**
 * DiscoverCollections — the Sloe v3 Discover "Collections" gradient tiles (web
 * twin of the SIM-SEE-validated mobile component, ENG-1225 Block 6). Each tile
 * deep-links into a category pill; counts are live. Forces the flag so the
 * self-gating component renders in isolation.
 */
declare global {
  interface Window {
    __SUPPR_FORCE_FLAGS__?: Record<string, boolean>;
  }
}
if (typeof window !== "undefined") {
  window.__SUPPR_FORCE_FLAGS__ = {
    ...(window.__SUPPR_FORCE_FLAGS__ ?? {}),
    sloe_v3_discover_editorial: true,
  };
}

const rc = (id: string, o: Partial<RecipeCard> = {}): RecipeCard =>
  ({
    id,
    title: id,
    calories: 500,
    protein: 40, // high protein
    carbs: 40,
    fat: 12,
    prepTimeMin: 5,
    cookTimeMin: 10, // quick
    ...o,
  }) as RecipeCard;

// Mix so both tiles carry honest, differing counts:
//   high-protein dinners → 5 (a–c + two slow high-protein), under-30 → 4 (a–c + one quick low-protein).
const recipes: RecipeCard[] = [
  rc("a"),
  rc("b"),
  rc("c"),
  rc("hp1", { protein: 38, prepTimeMin: 20, cookTimeMin: 40 }),
  rc("hp2", { protein: 41, prepTimeMin: 25, cookTimeMin: 35 }),
  rc("q1", { protein: 12, prepTimeMin: 4, cookTimeMin: 8 }),
];

function Frame({ width, children }: { width: number; children: React.ReactNode }) {
  return (
    <div style={{ width, background: "var(--background)", padding: 20, borderRadius: 24 }}>
      {children}
    </div>
  );
}

const meta = {
  title: "Discover/DiscoverCollections",
  component: DiscoverCollections,
  tags: ["ai-generated"],
  parameters: { layout: "centered" },
  args: { recipes, onSelectCategory: () => {} },
} satisfies Meta<typeof DiscoverCollections>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MobileWeb: Story = {
  name: "Mobile-web (2-col)",
  render: () => (
    <Frame width={390}>
      <DiscoverCollections recipes={recipes} onSelectCategory={() => {}} />
    </Frame>
  ),
};

export const Desktop: Story = {
  name: "Desktop",
  render: () => (
    <Frame width={760}>
      <DiscoverCollections recipes={recipes} onSelectCategory={() => {}} />
    </Frame>
  ),
};
