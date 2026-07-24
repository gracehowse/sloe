import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ShoppingListRow } from "./ShoppingListRow";
import type { ShoppingDisplayGroup } from "../../../lib/planning/shoppingDisplayGroups";
import type { ShoppingItem } from "../../../types/recipe";

function item(over: Partial<ShoppingItem> & { id: string; name: string }): ShoppingItem {
  return {
    amount: "200",
    unit: "g",
    category: "Produce",
    checked: false,
    from: "Miso salmon bowl",
    ...over,
  };
}

function group(key: string, displayName: string, items: ShoppingItem[]): ShoppingDisplayGroup {
  return { key, displayName, items };
}

const SINGLE = group("g-tenderstem", "Tenderstem broccoli", [
  item({ id: "i1", name: "Tenderstem broccoli", amount: "200", unit: "g" }),
]);

/** Same ingredient pulled by three different recipes — the provenance case. */
const MULTI_RECIPE = group("g-onion", "Red onion", [
  item({ id: "i2", name: "Red onion", amount: "1", unit: "", from: "Harissa chickpea stew" }),
  item({ id: "i3", name: "Red onion", amount: "1/2", unit: "", from: "Charred broccoli with tahini" }),
  item({ id: "i4", name: "Red onion", amount: "1", unit: "", from: "Lemon herb chicken tray bake" }),
]);

const CHECKED = group("g-oats", "Rolled oats", [
  item({ id: "i5", name: "Rolled oats", amount: "500", unit: "g", category: "Pantry", checked: true }),
]);

const CHECKED_BY_MEMBER = group("g-milk", "Whole milk", [
  item({
    id: "i6",
    name: "Whole milk",
    amount: "2",
    unit: "l",
    category: "Dairy",
    checked: true,
    checkedBy: "user-2",
  }),
]);

const MEMBERS = new Map([
  ["user-1", { displayName: "Grace", index: 0 }],
  ["user-2", { displayName: "Sam", index: 1 }],
]);

const meta = {
  title: "Suppr/Shopping/ShoppingListRow",
  component: ShoppingListRow,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "One aisle row in the shopping list. Under `design_consistency_v1` + `densityV1` it renders the in-store scan layout: quantity leads in bold, the ingredient name follows, and the checkbox sits right where the thumb is — a square 4px checkbox rather than the rounded card-era pill, because a shopping list is a scan surface, not a card stack. Checked rows strike through and drop to muted; household lists attribute the check to the member who made it. Trailing actions (staple, delete) come from one control rendered either as the swipe rail or the compact pointer-device cluster, so the test ids and accessible names cannot fork.",
      },
    },
  },
  decorators: [
    (Story) => (
      <ul style={{ maxWidth: 480, listStyle: "none", margin: 0, padding: 0 }}>
        <Story />
      </ul>
    ),
  ],
  args: {
    group: SINGLE,
    densityV1: true,
    activeHouseholdId: null,
    memberById: new Map(),
    onToggle: () => undefined,
    onRemove: () => undefined,
    onMarkStaple: () => undefined,
  },
} satisfies Meta<typeof ShoppingListRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The scan row: bold quantity, name, checkbox on the right. */
export const Default: Story = {};

/** Aggregated across three recipes — the provenance caption earns its line. */
export const MultipleRecipes: Story = {
  args: { group: MULTI_RECIPE },
};

/** Bought: struck through and muted, so the eye skips it on the next pass. */
export const Checked: Story = {
  args: { group: CHECKED },
};

/** Household list — the row says who ticked it, not just that it is ticked. */
export const CheckedByHouseholdMember: Story = {
  args: {
    group: CHECKED_BY_MEMBER,
    activeHouseholdId: "hh-1",
    memberById: MEMBERS,
  },
};

/**
 * `densityV1={false}` — the pre-ENG-1669 card row, which is also what the
 * `design_consistency_v1` kill switch lands on. Kept so the rollback surface
 * is snapshotted rather than assumed.
 */
export const LegacyCardRow: Story = {
  args: { group: MULTI_RECIPE, densityV1: false },
};

/** A long ingredient name against a long quantity — the truncation case. */
export const LongName: Story = {
  args: {
    group: group("g-long", "Sun-dried tomatoes in olive oil", [
      item({
        id: "i7",
        name: "Sun-dried tomatoes in extra virgin olive oil, drained",
        amount: "280",
        unit: "g",
        category: "Pantry",
        from: "Charred miso aubergine bowl, Harissa chickpea stew",
      }),
    ]),
  },
};
