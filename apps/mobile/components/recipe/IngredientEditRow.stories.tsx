import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { IngredientEditRow } from "./IngredientEditRow";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Recipe/IngredientEditRow",
  component: IngredientEditRow,
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
  args: { ingredient: { rowId: "1", localKey: "local-1", name: "Salmon fillet", amount: "2", unit: "x 150g" }, onChange: () => undefined, onDelete: () => undefined },
} satisfies Meta<typeof IngredientEditRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = {} as Story;
export const NewRow: Story = { args: { ingredient: { rowId: null, localKey: "new", name: "", amount: "", unit: "", addedByUser: true } } };
