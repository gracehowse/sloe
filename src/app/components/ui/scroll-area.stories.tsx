import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ScrollArea } from "./scroll-area";
import { Separator } from "./separator";

const meta = {
  component: ScrollArea,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Custom-styled scroll viewport (Radix Scroll Area) with a thin scrollbar thumb. Prefer for constrained lists inside cards/sheets.",
      },
    },
  },
} satisfies Meta<typeof ScrollArea>;

export default meta;
type Story = StoryObj<typeof meta>;

const tags = Array.from({ length: 20 }, (_, i) => `Tag ${i + 1}`);

export const Vertical: Story = {
  render: () => (
    <ScrollArea className="h-48 w-56 rounded-md border">
      <div className="p-4">
        <h4 className="mb-4 text-sm font-medium">Tags</h4>
        {tags.map((tag) => (
          <div key={tag}>
            <div className="py-2 text-sm">{tag}</div>
            <Separator />
          </div>
        ))}
      </div>
    </ScrollArea>
  ),
};

export const ShortContent: Story = {
  render: () => (
    <ScrollArea className="h-32 w-56 rounded-md border">
      <div className="p-4 text-sm text-muted-foreground">Only a few lines — no overflow.</div>
    </ScrollArea>
  ),
};
