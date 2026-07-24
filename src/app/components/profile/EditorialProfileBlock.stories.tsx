import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { EditorialProfileBlock } from "./EditorialProfileBlock";
import { buildEditorialProfileBlock } from "../../../lib/profile/editorialProfileBlock";
import type { StreakByDay } from "../../../lib/nutrition/streakFreeze";

/**
 * EditorialProfileBlock — the shared editorial Profile block (Gap #16, ENG-1246):
 * identity → streak dots + best/freezes line → milestones list → recipe grid.
 * Display-only; the host derives `model` from already-loaded data. Pins the
 * populated + empty states as a durable visual regression layer.
 */
const NOW = new Date("2026-06-10T12:00:00");

function loggedDays(...keys: string[]): StreakByDay {
  const byDay: StreakByDay = {};
  for (const k of keys) byDay[k] = [{ calories: 480 }];
  return byDay;
}

const populatedModel = buildEditorialProfileBlock({
  // A 5-day run to today, plus a frozen gap the day before it.
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

const sampleRecipes = [
  { id: "r1", title: "Charred broccoli & tahini", image: null },
  { id: "r2", title: "Miso salmon bowl", image: null },
  { id: "r3", title: "Chickpea shakshuka", image: null },
  { id: "r4", title: "Lemon herb chicken", image: null },
  { id: "r5", title: "Peanut noodle stir-fry", image: null },
  { id: "r6", title: "Roast squash salad", image: null },
];

const meta = {
  title: "Suppr/Profile/EditorialProfileBlock",
  component: EditorialProfileBlock,
  tags: ["ai-generated", "autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The Profile block: identity → labelled streak pips → milestones → saved-recipe grid. Under `design_consistency_v1` the tier is stated once with an accent Pro badge, the streak row gains weekday letters so the pips are readable rather than decorative, milestones lead with the actionable one, and the empty saved-recipes copy ships a real ghost 'Browse Discover' CTA via `onBrowseDiscover` instead of telling the user to go somewhere with no way to get there. Ghost, because the screen's one filled CTA is Upgrade. Mobile twin: apps/mobile/components/profile/EditorialProfileBlock.tsx.",
      },
    },
  },
  args: {
    displayName: "Grace",
    joinedLabel: "Joined 2mo ago",
    monogramInitial: "G",
    tierLabel: "Pro",
    isPro: true,
    model: populatedModel,
    recipes: sampleRecipes,
    recipeCount: 14,
    onOpenRecipe: () => {},
    onSeeAllRecipes: () => {},
  },
  decorators: [
    (Story) => (
      <div style={{ width: 390, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EditorialProfileBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Populated Pro account — full streak dots, freezes in hand, milestones, grid. */
export const Populated: Story = {};

/** Fresh free account — no streak, no saved recipes; the block reads calmly at
 *  zero, and the empty grid ships the ghost "Browse Discover" escape hatch the
 *  copy promises. */
export const EmptyFreeAccount: Story = {
  args: {
    displayName: "",
    joinedLabel: "Joined this week",
    monogramInitial: "S",
    tierLabel: "Free",
    isPro: false,
    model: emptyModel,
    recipes: [],
    recipeCount: 0,
    onBrowseDiscover: () => {},
    onUpgrade: () => {},
  },
};

/**
 * The same empty state with `onBrowseDiscover` omitted — the pre-consistency
 * dead end, where the copy said "Browse Discover" and offered no way there.
 * Kept as the visible contrast for the kill-switch path.
 */
export const EmptyWithoutDiscoverCta: Story = {
  args: {
    ...EmptyFreeAccount.args,
    onBrowseDiscover: undefined,
  },
};

/** ENG-1641 — non-Pro footer shows the single primary Upgrade CTA. */
export const FreeWithUpgradeCta: Story = {
  args: {
    ...EmptyFreeAccount.args,
    displayName: "Grace",
    monogramInitial: "G",
    onUpgrade: () => {},
  },
};
