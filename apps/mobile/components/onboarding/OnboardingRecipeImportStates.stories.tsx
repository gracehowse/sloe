import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ImportProgress, ImportSuccess } from "./OnboardingRecipeImportStates";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Onboarding/OnboardingRecipeImportStates",
  component: ImportProgress,
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
  
} satisfies Meta<typeof ImportProgress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Progress: Story = { render: () => <ImportProgress /> };
export const Success: Story = { render: () => <ImportSuccess summary={{ title: "Mob Kitchen pasta", servings: 4, totalMinutes: 35, sourceHost: "mob.co.uk" }} onImportAnother={() => undefined} /> };
