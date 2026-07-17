import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent } from "storybook/test";
import { SegmentedTrack, type SegmentedTrackOption } from "./segmented-track";

// Instantiation-expression alias pins the generic to `string` so Storybook
// infers concrete args instead of an unresolved type parameter.
const Track = SegmentedTrack<string>;

const options: SegmentedTrackOption<string>[] = [
  { value: "plan", label: "This week" },
  { value: "shopping", label: "Shopping" },
];

const meta = {
  component: Track,
  tags: ["ai-generated"],
  parameters: { layout: "padded" },
  args: {
    options,
    value: "plan",
    ariaLabel: "Plan sections",
    onChange: fn(),
  },
} satisfies Meta<typeof Track>;

export default meta;
type Story = StoryObj<typeof meta>;

/** THE §8 track-and-thumb segmented control. Clicking the active segment is
 *  a no-op; clicking an inactive one fires onChange with its value. */
export const Default: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole("tab", { name: "This week" }));
    await expect(args.onChange).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole("tab", { name: "Shopping" }));
    await expect(args.onChange).toHaveBeenCalledWith("shopping");
  },
};

/** ENG-1532 amendment — per-option count badge (the Plan Shopping unchecked
 *  count). Hidden at 0; caps at "999+". */
export const WithBadge: Story = {
  args: {
    options: [
      { value: "plan", label: "This week" },
      { value: "shopping", label: "Shopping", badge: 5 },
    ],
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("5")).toBeInTheDocument();
  },
};

/** Badge cap — counts above 999 render "999+". */
export const BadgeCapped: Story = {
  args: {
    options: [
      { value: "plan", label: "This week" },
      { value: "shopping", label: "Shopping", badge: 1234 },
    ],
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("999+")).toBeInTheDocument();
  },
};

/** Hug fit — the track hugs its labels instead of stretching. */
export const Hug: Story = { args: { fit: "hug" } };
