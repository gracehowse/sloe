import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "./context-menu";

const meta = {
  component: ContextMenu,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Right-click (or long-press) menu for contextual actions on a target. Chromatic Open story forces the menu visible via controlled `open`.",
      },
    },
  },
} satisfies Meta<typeof ContextMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

function MenuBody() {
  return (
    <ContextMenuContent>
      <ContextMenuItem>Edit</ContextMenuItem>
      <ContextMenuItem>Duplicate</ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem variant="destructive">Delete</ContextMenuItem>
    </ContextMenuContent>
  );
}

export const Default: Story = {
  render: () => (
    <ContextMenu>
      <ContextMenuTrigger className="flex h-32 w-64 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        Right-click here
      </ContextMenuTrigger>
      <MenuBody />
    </ContextMenu>
  ),
};

export const Open: Story = {
  render: () => (
    <ContextMenu open>
      <ContextMenuTrigger className="flex h-32 w-64 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        Menu open
      </ContextMenuTrigger>
      <MenuBody />
    </ContextMenu>
  ),
};
