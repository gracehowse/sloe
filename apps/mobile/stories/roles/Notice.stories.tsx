import type { Meta, StoryObj } from "@storybook/react";

import ImplausibleMacrosNotice, {
  IMPLAUSIBLE_MACROS_COPY,
} from "@/components/ImplausibleMacrosNotice";
import { Accent, Colors } from "@/constants/theme";

import { createMobileRoleMeta } from "../_fixtures/createRoleMeta";

const lightColors = {
  text: Colors.light.text,
  cardBorder: Colors.light.border,
  background: Colors.light.backgroundSecondary,
};

const meta = {
  ...createMobileRoleMeta({
    title: "Mobile/Roles/Notice",
    component: ImplausibleMacrosNotice,
    role: "Notice",
  }),
  render: (args) => <ImplausibleMacrosNotice {...args} />,
} satisfies Meta<typeof ImplausibleMacrosNotice>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Rest: Story = {
  args: {
    visible: true,
    acknowledged: false,
    onToggle: () => {},
    colors: lightColors,
  },
};

export const Acknowledged: Story = {
  name: "Rest (acknowledged)",
  args: {
    visible: true,
    acknowledged: true,
    onToggle: () => {},
    colors: lightColors,
  },
};

export const DarkScheme: Story = {
  name: "Rest (dark)",
  parameters: { globals: { theme: "dark" } },
  args: {
    visible: true,
    acknowledged: false,
    onToggle: () => {},
    colors: {
      text: Colors.dark.text,
      cardBorder: Colors.dark.border,
      background: Colors.dark.backgroundSecondary,
    },
  },
  play: async () => {
    // Copy is parity-pinned across platforms.
    if (!IMPLAUSIBLE_MACROS_COPY.includes("sanity check")) {
      throw new Error("Notice copy drifted");
    }
    void Accent.warningSolid;
  },
};
