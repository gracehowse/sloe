import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

const meta = {
  component: Tabs,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Segmented tab panels (Radix Tabs). Prefer `SubTabPill` / `SegmentedTrack` for product filter chrome when those roles apply.",
      },
    },
  },
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="macros" className="w-full max-w-md">
      <TabsList>
        <TabsTrigger value="macros">Macros</TabsTrigger>
        <TabsTrigger value="micros">Micros</TabsTrigger>
        <TabsTrigger value="notes">Notes</TabsTrigger>
      </TabsList>
      <TabsContent value="macros" className="pt-3 text-sm text-muted-foreground">
        Protein 92g · Carbs 180g · Fat 55g
      </TabsContent>
      <TabsContent value="micros" className="pt-3 text-sm text-muted-foreground">
        Iron 8mg · Calcium 320mg
      </TabsContent>
      <TabsContent value="notes" className="pt-3 text-sm text-muted-foreground">
        Felt steady energy after lunch.
      </TabsContent>
    </Tabs>
  ),
};

export const NotesSelected: Story = {
  render: () => (
    <Tabs defaultValue="notes" className="w-full max-w-md">
      <TabsList>
        <TabsTrigger value="macros">Macros</TabsTrigger>
        <TabsTrigger value="micros">Micros</TabsTrigger>
        <TabsTrigger value="notes">Notes</TabsTrigger>
      </TabsList>
      <TabsContent value="macros" className="pt-3 text-sm text-muted-foreground">
        Protein 92g · Carbs 180g · Fat 55g
      </TabsContent>
      <TabsContent value="micros" className="pt-3 text-sm text-muted-foreground">
        Iron 8mg · Calcium 320mg
      </TabsContent>
      <TabsContent value="notes" className="pt-3 text-sm text-muted-foreground">
        Felt steady energy after lunch.
      </TabsContent>
    </Tabs>
  ),
};
