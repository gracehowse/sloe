import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SheetGrabberBar, SheetShell } from "./sheet-shell";
import { Button } from "./button";

const noop = () => undefined;

const meta = {
  component: SheetShell,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Bottom-sheet chassis — scrim + 24px top corners + grabber (ENG-1662). Content-only children; host owns title/actions.",
      },
    },
  },
  args: {
    open: true,
    onClose: noop,
  },
} satisfies Meta<typeof SheetShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  args: { open: true, onClose: noop, children: null },
  render: (args) => (
    <SheetShell {...args}>
      <h2 className="text-lg font-semibold text-foreground">Adjust targets</h2>
      <p className="mt-2 text-sm text-foreground-secondary">
        Update today&apos;s calorie and macro goals.
      </p>
      <div className="mt-6 flex gap-3">
        <Button onClick={noop}>Save</Button>
        <Button variant="ghost" onClick={args.onClose}>
          Cancel
        </Button>
      </div>
    </SheetShell>
  ),
};

export const WithLongContent: Story = {
  args: { open: true, onClose: noop, children: null },
  render: (args) => (
    <SheetShell {...args}>
      <h2 className="text-lg font-semibold text-foreground">Log meal</h2>
      <p className="mt-2 text-sm text-foreground-secondary">
        Choose a slot and confirm portions before logging.
      </p>
      <ul className="mt-4 space-y-2 text-sm text-foreground">
        <li>Breakfast — oats + berries</li>
        <li>Lunch — miso salmon bowl</li>
        <li>Dinner — open slot</li>
      </ul>
      <Button className="mt-6 w-full" onClick={noop}>
        Continue
      </Button>
    </SheetShell>
  ),
};

export const GrabberBar: Story = {
  args: { open: true, onClose: noop, children: null },
  render: () => (
    <div className="rounded-t-[var(--radius-card-lg)] bg-card px-5 pb-6 pt-4">
      <SheetGrabberBar />
      <p className="text-sm text-foreground-secondary">Grabber-only preview inside a sheet body.</p>
    </div>
  ),
  parameters: { layout: "centered" },
};
