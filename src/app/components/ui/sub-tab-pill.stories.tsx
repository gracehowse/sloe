import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent } from "storybook/test";
import { SubTabPill, type SubTabItem } from "./sub-tab-pill";

// Instantiation-expression alias pins the generic to `string` so Storybook
// infers concrete args instead of an unresolved type parameter.
const SubTabs = SubTabPill<string>;

const items: SubTabItem<string>[] = [
  // Active, badge that shows (5), explicit accessibility label.
  { id: "overview", label: "Overview", badge: 5, accessibilityLabel: "Overview tab" },
  // Inactive, badge that hides (0 → formatSidebarBadge show:false).
  { id: "details", label: "Details", badge: 0 },
  // Inactive, badge that shows (3).
  { id: "saved", label: "Saved", badge: 3 },
  // Inactive, no badge.
  { id: "more", label: "More" },
];

const meta = {
  component: SubTabs,
  tags: ["ai-generated"],
  parameters: { layout: "padded" },
  args: {
    items,
    activeId: "overview",
    accessibilityLabel: "Recipe sections",
    onSelect: fn(),
  },
} satisfies Meta<typeof SubTabs>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default underline tab bar. Clicking the active tab is a no-op. */
export const Default: Story = {
  play: async ({ canvas, args }) => {
    // Re-selecting the active tab does not fire onSelect.
    await userEvent.click(canvas.getByRole("tab", { name: "Overview tab" }));
    await expect(args.onSelect).not.toHaveBeenCalled();
    // Selecting an inactive tab fires onSelect with its id.
    await userEvent.click(canvas.getByRole("tab", { name: "Details" }));
    await expect(args.onSelect).toHaveBeenCalledWith("details");
  },
};

/** Embedded under screen chrome — tighter top padding. */
export const Embedded: Story = { args: { embedded: true } };

/** Scrollable variant for overflowing tab sets. */
export const Scrollable: Story = { args: { scrollable: true } };
