import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CookieConsent } from "./CookieConsent";

const CONSENT_KEY = "suppr_cookie_consent";

const meta = {
  title: "Host/CookieConsent",
  component: CookieConsent,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          "Analytics consent strip — top-anchored on marketing routes, bottom-docked on product mobile-web.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="relative min-h-[320px] bg-background">
        <Story />
      </div>
    ),
  ],
  beforeEach: () => {
    localStorage.removeItem(CONSENT_KEY);
  },
} satisfies Meta<typeof CookieConsent>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Landing / marketing — banner pins to the top under the sticky nav inset. */
export const MarketingTop: Story = {
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/" },
    },
  },
};

/** Signed-in product tab — banner lifts above the mobile-web bottom chrome. */
export const ProductRouteBottom: Story = {
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/today" },
    },
  },
};
