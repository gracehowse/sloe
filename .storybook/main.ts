import type { StorybookConfig } from "@storybook/nextjs-vite";
import { mergeMobileStorybookVite } from "./mobile-vite.ts";

const config: StorybookConfig = {
  stories: [
    "../src/**/*.mdx",
    "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)",
    // Role catalog (ENG-1664 sheet-pressable) + colocated component stories (coverage gate).
    "../apps/mobile/stories/**/*.stories.@(js|jsx|mjs|ts|tsx)",
    "../apps/mobile/components/**/*.stories.@(js|jsx|mjs|ts|tsx)",
  ],
  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
    "@storybook/addon-themes",
    "@storybook/addon-vitest",
    "@chromatic-com/storybook",
  ],
  framework: "@storybook/nextjs-vite",
  staticDirs: process.env.SUPPR_STORYBOOK_SKIP_STATIC_DIRS === "1" ? [] : ["../public"],
  async viteFinal(config) {
    return mergeMobileStorybookVite(config);
  },
};

export default config;
