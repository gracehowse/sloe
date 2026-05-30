import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, fireEvent, userEvent } from "storybook/test";
import {
  SettingsSegmented,
  type SettingsSegmentedOption,
} from "./settings-segmented";

// Instantiation-expression alias pins the generic to `string` so Storybook
// infers concrete args instead of an unresolved type parameter.
const Segmented = SettingsSegmented<string>;

const options: SettingsSegmentedOption<string>[] = [
  { value: "metric", label: "Metric", hint: "kg, cm" },
  { value: "imperial", label: "Imperial", hint: "lb, ft" },
  { value: "auto", label: "Auto" },
];

const meta = {
  component: Segmented,
  tags: ["ai-generated"],
  parameters: { layout: "padded" },
  args: {
    options,
    value: "metric",
    ariaLabel: "Unit system",
    onChange: fn(),
  },
} satisfies Meta<typeof Segmented>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default flex row. Arrow keys move the selection; non-arrow keys are ignored. */
export const Row: Story = {
  play: async ({ canvas, args }) => {
    const group = canvas.getByRole("radiogroup", { name: "Unit system" });
    // A non-arrow key is ignored by the handler.
    fireEvent.keyDown(group, { key: "Enter" });
    await expect(args.onChange).not.toHaveBeenCalled();
    // ArrowRight advances metric → imperial.
    fireEvent.keyDown(group, { key: "ArrowRight" });
    await expect(args.onChange).toHaveBeenLastCalledWith("imperial");
    // ArrowLeft wraps metric → auto.
    fireEvent.keyDown(group, { key: "ArrowLeft" });
    await expect(args.onChange).toHaveBeenLastCalledWith("auto");
    // Clicking an option fires onChange with its value. The radio's
    // accessible name is the label + hint ("Imperial lb, ft"), so match
    // on a substring.
    await userEvent.click(canvas.getByRole("radio", { name: /Imperial/ }));
    await expect(args.onChange).toHaveBeenLastCalledWith("imperial");
  },
};

/** 3-column grid layout for longer hints. */
export const GridLayout: Story = { args: { layout: "grid-3" } };

/** Defensive: a `value` not present in `options` selects nothing and
 *  arrow keys are no-ops (the `findIndex < 0` guard). */
export const ValueNotInOptions: Story = {
  args: { value: "zzz" },
  play: async ({ canvas, args }) => {
    const group = canvas.getByRole("radiogroup", { name: "Unit system" });
    fireEvent.keyDown(group, { key: "ArrowRight" });
    await expect(args.onChange).not.toHaveBeenCalled();
  },
};
