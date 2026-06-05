import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { NorthStarBlock, type NorthStarBlockSuggestion } from "./north-star-block";

/**
 * NorthStarBlock — the "What to eat next" permanent block on Today (the
 * north-star moment, spec D-2026-04-27-04). One suggested recipe at a time,
 * skippable, one-tap log. Presentation-only: the caller picks the `kind`
 * branch. Mirrors mobile `NorthStarBlock`.
 *
 * Stories cover every branch: `default` (gradient suggestion card with
 * thumb / why-line / fit chip / CTA), `library-empty`, `no-fit`,
 * `over-budget`, and `new-user`. Callbacks are no-ops.
 *
 * `default` renders a `RecipeHeroFallback` when no thumbnail is supplied
 * (the suggestion below omits `thumbnail`), so the story has no network dep.
 */

const SUGGESTION: NorthStarBlockSuggestion = {
  recipeId: "r-tikka",
  title: "Chicken tikka with rice",
  predictedCalories: 698,
  predictedProtein: 52,
  predictedCarbs: 74,
  predictedFat: 18,
  bandLabel: "Hits within 3%",
  bandTight: true,
  whyLine: "Closes your remaining protein gap",
};

const meta = {
  title: "Suppr/NorthStarBlock",
  component: NorthStarBlock,
  tags: ["ai-generated"],
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div className="w-[380px]">
        <Story />
      </div>
    ),
  ],
  args: {
    onPrimaryCta: () => {},
    onSkip: () => {},
    onBrowse: () => {},
    onOpenLibrary: () => {},
  },
} satisfies Meta<typeof NorthStarBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default — the hero suggestion: gradient card, recipe-fallback thumb,
 *  "What to eat next" eyebrow, tight-fit success chip, macro line, CTA. */
export const Default: Story = {
  args: { kind: "default", suggestion: SUGGESTION, ctaLabel: "Log it" },
};

/** Default with a softer (non-tight) fit band — muted chip instead of the
 *  success-tinted one. */
export const SoftFit: Story = {
  args: {
    kind: "default",
    ctaLabel: "Cook it",
    suggestion: {
      ...SUGGESTION,
      bandLabel: "Roughly fits",
      bandTight: false,
      whyLine: "A bit over on carbs, but close on calories",
    },
  },
};

/** library-empty — primary invitation when the library has < 5 recipes.
 *  a11y.test "todo": the "Open Library" button + body use `text-primary`
 *  (Sloe clay ~3.05:1 on the tint) — a pre-existing re-skin AA miss, not
 *  introduced here; axe still runs as a warning. */
export const LibraryEmpty: Story = {
  args: { kind: "library-empty" },
  parameters: { a11y: { test: "todo" } },
};

/** no-fit — calm caption when nothing in the library fits today's
 *  remaining macros, with a Browse escape hatch. a11y.test "todo" for the
 *  same pre-existing `text-primary` clay contrast miss as library-empty. */
export const NoFit: Story = {
  args: { kind: "no-fit" },
  parameters: { a11y: { test: "todo" } },
};

/** over-budget — the suggestion collapses to a calm "eat freely" caption
 *  when the ring is already over for the day. */
export const OverBudget: Story = {
  args: { kind: "over-budget" },
};

/** new-user — calmer "log your first meal" card before any history exists
 *  (ENG-94), instead of a presumptuous algorithmic suggestion. */
export const NewUser: Story = {
  args: { kind: "new-user" },
};

export const DefaultDark: Story = {
  args: { kind: "default", suggestion: SUGGESTION, ctaLabel: "Log it" },
  globals: { theme: "dark" },
};
