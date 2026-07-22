import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { RecipeStandfirst } from "./RecipeStandfirst";

const meta = {
  title: "Mobile/Recipe/RecipeStandfirst",
  component: RecipeStandfirst,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <MobileStoryThemeProvider>
        <div style={{ width: 360, padding: 16, background: "#F7F6FA" }}>
          <Story />
        </div>
      </MobileStoryThemeProvider>
    ),
  ],
  parameters: { layout: "fullscreen" },
  args: {
    text: "A bright, protein-forward bowl for weeknight dinners.",
    proteinG: 32,
  },
} satisfies Meta<typeof RecipeStandfirst>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = {} as Story;

export const ProteinFallback: Story = {
  name: "Protein fallback copy",
  args: { text: "", proteinG: 28 },
};
