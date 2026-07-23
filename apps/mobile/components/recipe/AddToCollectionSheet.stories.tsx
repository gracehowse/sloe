import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AddToCollectionSheet } from "./AddToCollectionSheet";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Recipe/AddToCollectionSheet",
  component: AddToCollectionSheet,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <MobileStoryThemeProvider>
        <div style={ { width: 360, padding: 16, background: "#F7F6FA" } }>
          <Story />
        </div>
      </MobileStoryThemeProvider>
    ),
  ],
  parameters: { layout: "fullscreen" },
  args: { visible: true, onClose: () => undefined, recipeTitle: "Miso ginger salmon", collections: [{"id":"c1","name":"Weeknight winners","sortOrder":0,"createdAt":"2026-01-01T00:00:00.000Z"}, {"id":"c2","name":"Meal prep","sortOrder":1,"createdAt":"2026-01-02T00:00:00.000Z"}], memberOf: ["c1"], onToggle: () => undefined },
} satisfies Meta<typeof AddToCollectionSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open = {} as Story;
export const EmptyMembership: Story = { args: { memberOf: [] } };
