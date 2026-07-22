import React from "react";
import type { Decorator } from "@storybook/react";
import { View } from "react-native";

import { ThemeProvider } from "./storybook-theme";
import { MobileStoryFrame } from "./MobileStoryFrame";

export type MobileStoryGlobals = {
  theme?: "light" | "dark" | string;
};

/** Wraps mobile role stories with sync theme + page-ground frame. */
export const withMobileStorybookTheme: Decorator = (Story, context) => {
  const scheme = context.globals.theme === "dark" ? "dark" : "light";

  return (
    <ThemeProvider scheme={scheme}>
      <View style={{ alignItems: "flex-start" }}>
        <MobileStoryFrame>
          <Story />
        </MobileStoryFrame>
      </View>
    </ThemeProvider>
  );
};
