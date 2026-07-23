import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RecipeTitleBlock } from "./RecipeTitleBlock";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Recipe/RecipeTitleBlock",
  component: RecipeTitleBlock,
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
  args: {
    title: "Miso ginger salmon with sesame greens",
    attribution: { label: "@sloekitchen", handleHref: "/creator/sloe", originalHref: "https://example.com/recipe" },
    verdict: null,
    onNavigate: () => undefined,
  },
} satisfies Meta<typeof RecipeTitleBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithSource = {} as Story;
export const TitleOnly: Story = { args: { attribution: null } };
