import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  NorthStarBlock,
  type NorthStarBlockSuggestion,
} from "./north-star-block";

/**
 * NorthStarBlock — "What to eat next" permanent block on Today (web; mirrors
 * `apps/mobile/components/today/NorthStarBlock.tsx`). Presentation-only — the
 * host picks the `kind`. Pins the state branches so Chromatic + the a11y gate
 * guard them as a durable regression layer:
 *
 *   - default        → gradient suggestion card with thumb, why-line, band
 *                      chip, macro line, and the single primary CTA.
 *   - new-user       → calmer "log your first meal" card on a user's very
 *                      first day (no nutrition history yet).
 *   - no-fit         → "library has nothing under your remaining macros" calm
 *                      caption + Browse link.
 *   - library-empty  → flattened inset-row invitation when the library < 5.
 *
 * The default branch renders the legacy card (the Figma-654 hero variant is
 * flag-gated on `today_meals_figma_654`, off in Storybook).
 */
const SUGGESTION: NorthStarBlockSuggestion = {
  recipeId: "r-salmon-bowl",
  title: "Miso salmon rice bowl",
  predictedCalories: 642,
  predictedProtein: 41,
  predictedCarbs: 58,
  predictedFat: 22,
  bandLabel: "Close fit",
  bandTight: true,
  whyLine: "Closes your remaining protein for today",
  cookTimeMin: 25,
};

const meta = {
  title: "Suppr/NorthStarBlock",
  component: NorthStarBlock,
  tags: ["ai-generated"],
  parameters: { layout: "padded" },
  args: {
    kind: "default",
    suggestion: SUGGESTION,
    ctaLabel: "Log it",
    onPrimaryCta: () => {},
    onSkip: () => {},
    onBrowse: () => {},
    onOpenLibrary: () => {},
  },
  decorators: [
    (Story) => (
      <div style={{ width: 420, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof NorthStarBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default (with suggestion)",
  args: { kind: "default", suggestion: SUGGESTION },
};

export const FirstDay: Story = {
  name: "First day (new user)",
  args: { kind: "new-user" },
};

export const NoFit: Story = {
  name: "No fit (browse link)",
  args: { kind: "no-fit" },
};

export const LibraryEmpty: Story = {
  name: "Library empty (pick recipes)",
  args: { kind: "library-empty" },
};
