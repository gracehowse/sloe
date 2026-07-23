import type { Preview } from "@storybook/nextjs-vite";
import React from "react";
import { ThemeProvider } from "next-themes";
import { withThemeByClassName } from "@storybook/addon-themes";
import { initialize, mswLoader } from "msw-storybook-addon";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "../src/styles/index.css";
import { mswHandlers } from "./msw-handlers";
import { STORYBOOK_SAFE_AREA_METRICS } from "./stubs/safe-area-metrics";

initialize({ onUnhandledRequest: "bypass" });

const preview: Preview = {
  parameters: {
    layout: "centered",
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      test: "error",
    },
    msw: {
      handlers: mswHandlers,
    },
    // Full catalog publishes for browse; only stories that opt back in
    // (see `.storybook/chromaticVisualContract.ts` + visual-contract file list)
    // consume Chromatic snapshot quota. 2026-07-22 split.
    chromatic: {
      disableSnapshot: true,
    },
  },
  decorators: [
    (Story) => (
      <SafeAreaProvider initialMetrics={STORYBOOK_SAFE_AREA_METRICS}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <Story />
        </ThemeProvider>
      </SafeAreaProvider>
    ),
    withThemeByClassName({
      themes: {
        light: "",
        dark: "dark",
      },
      defaultTheme: "light",
    }),
  ],
  loaders: [mswLoader],
  async beforeEach() {
    localStorage.setItem("theme", "light");
  },
};

export default preview;
