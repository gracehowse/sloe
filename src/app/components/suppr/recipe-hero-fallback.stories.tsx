import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RecipeHeroFallback } from "./RecipeHeroFallback";

/**
 * RecipeHeroFallback — the never-white tinted slab shown when a recipe has no
 * image (ENG-1374 imagery epic). ENG-1552: the glyph is a fixed 32/48px icon,
 * so in a large hero slab (1100×260 web, ~340×200 mobile) it read as a lost
 * dot / broken image. It now scales with the container's smaller dimension
 * (`clamp(iconSize, 30cqmin, 112)`), floored at `iconSize` so thumbs are
 * unchanged. These stories pin the small→large glyph across container sizes so
 * Chromatic guards the scaling as a durable regression layer.
 */
function Slab({ w, h, iconSize = 48 }: { w: number; h: number; iconSize?: number }) {
  return (
    <div style={{ position: "relative", width: w, height: h, borderRadius: 24, overflow: "hidden" }}>
      <RecipeHeroFallback id="story-recipe-1" title="Charred miso aubergine bowl" iconSize={iconSize} />
    </div>
  );
}

const meta: Meta<typeof Slab> = {
  title: "suppr/RecipeHeroFallback",
  component: Slab,
  parameters: { layout: "centered" },
};
export default meta;

type Story = StoryObj<typeof Slab>;

/** Thumb — small container: the glyph stays at its `iconSize` floor. */
export const Thumb: Story = { args: { w: 72, h: 72, iconSize: 28 } };

/** Web hero — 1100×260: the glyph scales up to fill the slab, not a lost dot. */
export const HeroWide: Story = { args: { w: 640, h: 220, iconSize: 48 } };

/** Mobile hero — ~340×200 proportions. */
export const HeroMobile: Story = { args: { w: 340, h: 200, iconSize: 48 } };
