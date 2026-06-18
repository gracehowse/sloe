import type { StorybookConfig } from "@storybook/nextjs-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
    "@storybook/addon-themes",
    "@storybook/addon-vitest",
    "@chromatic-com/storybook"
  ],
  framework: "@storybook/nextjs-vite",
  staticDirs: process.env.SUPPR_STORYBOOK_SKIP_STATIC_DIRS === "1" ? [] : ["../public"],
};

export default config;
