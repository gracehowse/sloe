import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFrame, MOCK_RECIPE } from "../_mobileStoryDecorators";
import { EditorialProfileBlock } from "./EditorialProfileBlock";
import { buildEditorialProfileBlock } from "@/lib/editorialProfileBlock";
import type { StreakByDay } from "@suppr/nutrition-core/streakFreeze";

const NOW = new Date("2026-06-10T12:00:00");

function loggedDays(...keys: string[]): StreakByDay {
  const byDay: StreakByDay = {};
  for (const k of keys) byDay[k] = [{ calories: 480 }];
  return byDay;
}

const populatedModel = buildEditorialProfileBlock({
  byDay: loggedDays("2026-06-04", "2026-06-06", "2026-06-07", "2026-06-08", "2026-06-09", "2026-06-10"),
  freezeLedger: {
    earnedAt: [{ earnedAt: "2026-05-20T00:00:00Z" }, { earnedAt: "2026-06-01T00:00:00Z" }],
    usedHistory: [{ dateKey: "2026-06-05", earnedAt: "2026-05-20T00:00:00Z" }],
  },
  freezeBudgetMax: 3,
  now: NOW,
});

const emptyModel = buildEditorialProfileBlock({
  byDay: {},
  freezeLedger: { earnedAt: [], usedHistory: [] },
  freezeBudgetMax: 3,
  now: NOW,
});

const meta = {
  title: "Mobile/Profile/EditorialProfileBlock",
  component: EditorialProfileBlock,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The Profile block: identity → labelled streak pips → milestones → saved-recipe grid. Under `design_consistency_v1` the tier is stated once with an accent Pro badge, the streak row gains weekday letters so the pips are readable rather than decorative, milestones lead with the actionable one, and the empty saved-recipes copy ships a real ghost 'Browse Discover' CTA via `onBrowseDiscover` instead of naming a destination with no way to reach it. Ghost, because the screen's one filled CTA is Upgrade. Web twin: src/app/components/profile/EditorialProfileBlock.tsx.",
      },
    },
  },
} satisfies Meta<typeof EditorialProfileBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  args: {
    displayName: "Grace",
    joinedLabel: "Joined 2mo ago",
    monogramInitial: "G",
    tierLabel: "Pro",
    isPro: true,
    model: populatedModel,
    recipes: [
      MOCK_RECIPE,
      { id: "r2", title: "Overnight oats", image: null },
      { id: "r3", title: "Chickpea shakshuka", image: null },
    ],
    recipeCount: 14,
    onOpenRecipe: () => undefined,
    onSeeAllRecipes: () => undefined,
  },
};

/** Fresh free account — the empty grid ships the ghost "Browse Discover"
 *  escape hatch the copy promises. Parity with the web story. */
export const EmptyFreeAccount: Story = {
  args: {
    displayName: "Sam",
    joinedLabel: "Joined this week",
    monogramInitial: "S",
    tierLabel: "Free",
    isPro: false,
    model: emptyModel,
    recipes: [],
    recipeCount: 0,
    onOpenRecipe: () => undefined,
    onSeeAllRecipes: () => undefined,
    onBrowseDiscover: () => undefined,
  },
};

/**
 * The same empty state with `onBrowseDiscover` omitted — the pre-consistency
 * dead end, where the copy named Discover and offered no way there. Kept as
 * the visible contrast for the kill-switch path.
 */
export const EmptyWithoutDiscoverCta: Story = {
  args: {
    ...EmptyFreeAccount.args,
    onBrowseDiscover: undefined,
  },
};

/** Non-Pro footer with the single primary Upgrade CTA. */
export const FreeWithUpgradeCta: Story = {
  args: {
    ...EmptyFreeAccount.args,
    displayName: "Grace",
    monogramInitial: "G",
    onUpgrade: () => undefined,
  },
};
