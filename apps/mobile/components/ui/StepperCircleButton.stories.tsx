import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Minus, Plus } from "lucide-react-native";

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { IconSize } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { StepperCircleButton } from "./StepperCircleButton";

const noop = () => undefined;

function MinusIcon() {
  const colors = useThemeColors();
  return <Minus size={IconSize.sm} color={colors.text} />;
}

function PlusIcon() {
  const colors = useThemeColors();
  return <Plus size={IconSize.sm} color={colors.text} />;
}

const meta = {
  title: "Mobile/UI/StepperCircleButton",
  component: StepperCircleButton,
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
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "± circle for numeric steppers — tokenised sm/md/lg diameters (ENG-1662).",
      },
    },
  },
  args: {
    onPress: noop,
    accessibilityLabel: "Decrease",
    children: <MinusIcon />,
  },
} satisfies Meta<typeof StepperCircleButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Medium: Story = {};

export const SmallBordered: Story = {
  args: {
    size: "sm",
    bordered: true,
    accessibilityLabel: "Increase",
    children: <PlusIcon />,
  },
};

export const LargeDisabled: Story = {
  args: {
    size: "lg",
    disabled: true,
    accessibilityLabel: "Decrease",
    children: <MinusIcon />,
  },
};
