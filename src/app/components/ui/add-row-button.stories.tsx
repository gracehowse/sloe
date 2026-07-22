import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AddRowButton } from "./add-row-button";
import { chromaticVisualContract } from "../../../../.storybook/chromaticVisualContract";

const meta = {
  component: AddRowButton,
  tags: ["autodocs", "chromatic"],
  parameters: {
    ...chromaticVisualContract.parameters,
    layout: "padded",
    docs: {
      description: {
        component:
          "Anatomy role **AddRow** — quiet-fill inset action row (radius 12, 12-inside-24) for “add another X” inside a Card. Under `ui_anatomy_owners_v1`, left-aligned panel form. See `docs/design/2026-07-22-ui-anatomy-program.md`.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-sm rounded-[24px] border border-border bg-card p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AddRowButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: "Add food",
  },
};

export const Small: Story = {
  args: {
    label: "Add slot",
    size: "sm",
  },
};

export const Loading: Story = {
  args: {
    label: "Add food",
    loading: true,
  },
};

export const Disabled: Story = {
  args: {
    label: "Add food",
    disabled: true,
  },
};
