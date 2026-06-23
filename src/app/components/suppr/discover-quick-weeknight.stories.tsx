import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { RecipeCard } from "@/types/recipe";
import { DiscoverQuickWeeknight } from "./discover-quick-weeknight";

/**
 * DiscoverQuickWeeknight — the Sloe v3 Discover "Quick weeknight" section (web
 * twin of the SIM-SEE-validated mobile component, ENG-1225 Block 6). No-photo
 * tint cards in a 2-col (→3-col lg) grid. Forces the flag so the self-gating
 * component renders in isolation.
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

const rc = (id: string, title: string, o: Partial<RecipeCard> = {}): RecipeCard =>
  ({
    id,
    title,
    calories: 420,
    protein: 28,
    carbs: 40,
    fat: 12,
    prepTimeMin: 8,
    cookTimeMin: 12,
    ...o,
  }) as RecipeCard;

const recipes: RecipeCard[] = [
  rc("r1", "Classic Greek salad", { calories: 380, protein: 13, prepTimeMin: 15, cookTimeMin: 0 }),
  rc("r2", "Shakshuka with eggs", { calories: 410, protein: 22, prepTimeMin: 10, cookTimeMin: 20 }),
  rc("r3", "Five-minute egg wrap", { calories: 360, protein: 22, prepTimeMin: 3, cookTimeMin: 4 }),
  rc("r4", "Tahini grain bowl", { calories: 520, protein: 28, prepTimeMin: 12, cookTimeMin: 8 }),
  rc("r5", "Miso noodle soup", { calories: 440, protein: 19, prepTimeMin: 6, cookTimeMin: 14 }),
  rc("r6", "Halloumi flatbread", { calories: 560, protein: 26, prepTimeMin: 5, cookTimeMin: 12 }),
  rc("slow", "Slow lamb shoulder", { calories: 820, protein: 52, prepTimeMin: 20, cookTimeMin: 180 }),
];

function Frame({ width, children }: { width: number; children: React.ReactNode }) {
  return (
    <div style={{ width, background: "var(--background)", padding: 20, borderRadius: 24 }}>
      {children}
    </div>
  );
}

const meta = {
  title: "Discover/DiscoverQuickWeeknight",
  component: DiscoverQuickWeeknight,
  tags: ["ai-generated"],
  parameters: { layout: "centered" },
  args: { recipes, onPressRecipe: () => {} },
} satisfies Meta<typeof DiscoverQuickWeeknight>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MobileWeb: Story = {
  name: "Mobile-web (2-col)",
  render: () => (
    <Frame width={390}>
      <DiscoverQuickWeeknight recipes={recipes} onPressRecipe={() => {}} />
    </Frame>
  ),
};

export const Desktop: Story = {
  name: "Desktop (3-col)",
  render: () => (
    <Frame width={900}>
      <DiscoverQuickWeeknight recipes={recipes} onPressRecipe={() => {}} />
    </Frame>
  ),
};
