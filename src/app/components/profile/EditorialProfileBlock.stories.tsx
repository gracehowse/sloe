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
  tags: ["ai-generated"],
  parameters: { layout: "padded" },
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

/** Fresh free account — no streak, no saved recipes; the block reads calmly at zero. */
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
  },
};
