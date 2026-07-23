import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RecipeYieldEditorFields } from "./RecipeYieldEditorFields";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Recipe/RecipeYieldEditorFields",
  component: RecipeYieldEditorFields,
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
  args: { draft: { servings: 4, yieldLabel: "Serves 4" }, onChange: () => undefined, disabled: false },
} satisfies Meta<typeof RecipeYieldEditorFields>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Editable = {} as Story;
export const Disabled: Story = { args: { disabled: true } };
