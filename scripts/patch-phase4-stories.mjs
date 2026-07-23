#!/usr/bin/env node
/**
 * Patch Phase 4 mobile stories with real props, onboarding frame, hierarchy fixtures.
 */
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(import.meta.dirname, "..");
const noop = "() => undefined";

function write(rel, content) {
  const file = path.join(repo, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function frame(title, component, importBlock, metaExtra, stories, themeDepth = 4) {
  const tp = "../".repeat(themeDepth) + ".storybook/stubs/mobile-theme";
  return `import type { Meta, StoryObj } from "@storybook/nextjs-vite";
${importBlock}import { MobileStoryThemeProvider } from "${tp}";

const meta = {
  title: "${title}",
  component: ${component},
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
  ${metaExtra}
} satisfies Meta<typeof ${component}>;

export default meta;
type Story = StoryObj<typeof meta>;

${stories}
`;
}

function onboardingStep(title, fileBase, exportName, stepId) {
  return `import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { OnboardingStoryFrame } from "../_storyShell";
import { onboardingStoryInitial } from "../_storyFixtures";
import { ${exportName} } from "./${fileBase}";

const meta = {
  title: "Mobile/Onboarding/Steps/${title}",
  component: ${exportName},
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <OnboardingStoryFrame initial={onboardingStoryInitial("${stepId}")}>
        <Story />
      </OnboardingStoryFrame>
    ),
  ],
} satisfies Meta<typeof ${exportName}>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Prefilled: Story = {};
`;
}

const COL1 = { id: "c1", name: "Weeknight winners", sortOrder: 0, createdAt: "2026-01-01T00:00:00.000Z" };
const COL2 = { id: "c2", name: "Meal prep", sortOrder: 1, createdAt: "2026-01-02T00:00:00.000Z" };

const ING = `{ name: "Spaghetti", amount: 400, unit: "g", calories: 580, protein: 20, carbs: 112, fat: 2 }`;

// --- Recipe (14 new only) ---
const recipePatches = {
  "apps/mobile/components/recipe/AddToCollectionSheet.stories.tsx": frame(
    "Mobile/Recipe/AddToCollectionSheet",
    "AddToCollectionSheet",
    `import { AddToCollectionSheet } from "./AddToCollectionSheet";\n`,
    `args: {
    visible: true,
    onClose: ${noop},
    recipeTitle: "Miso ginger salmon",
    collections: [${JSON.stringify(COL1)}, ${JSON.stringify(COL2)}],
    memberOf: ["c1"],
    onToggle: ${noop},
  },`,
    `export const Open: Story = {};\nexport const EmptyMembership: Story = { args: { memberOf: [] } };`,
    4,
  ),
};

// onboarding steps
const steps = [
  ["Welcome", "welcome", "MobileWelcomeStep", "welcome"],
  ["Goal", "goal", "MobileGoalStep", "goal"],
  ["WhyNow", "why-now", "MobileWhyNowStep", "why-now"],
  ["Sex", "sex", "MobileSexStep", "sex"],
  ["Age", "age", "MobileAgeStep", "age"],
  ["Height", "height", "MobileHeightStep", "height"],
  ["Weight", "weight", "MobileWeightStep", "weight"],
  ["Activity", "activity", "MobileActivityStep", "activity"],
  ["Pace", "pace", "MobilePaceStep", "pace"],
  ["Diet", "diet", "MobileDietStep", "diet"],
  ["Strategy", "strategy", "MobileStrategyStep", "strategy"],
  ["AppChoice", "app-choice", "MobileAppChoiceStep", "app-choice"],
  ["Reveal", "reveal", "MobileRevealStep", "reveal"],
  ["RevealWhyNow", "reveal-why-now", "RevealWhyNowReflection", "reveal"],
  ["FirstLog", "first-log", "FirstLogStep", "first-log"],
];

for (const [title, file, exp, stepId] of steps) {
  recipePatches[`apps/mobile/components/onboarding/steps/${file}.stories.tsx`] = onboardingStep(title, file, exp, stepId);
}

// hierarchy
recipePatches["apps/mobile/components/progress/hierarchy/ProgressHierarchyV1.stories.tsx"] = frame(
  "Mobile/Progress/Hierarchy/ProgressHierarchyV1",
  "ProgressHierarchyV1",
  `import { ProgressHierarchyV1 } from "./ProgressHierarchyV1";\nimport { hierarchyBaseProps } from "./_storyFixtures";\n`,
  `args: hierarchyBaseProps(),`,
  `export const Default: Story = {};\nexport const WeightHidden: Story = { args: hierarchyBaseProps({ weightSurfaceMode: "hide" }) };`,
  5,
);

let n = 0;
for (const [rel, content] of Object.entries(recipePatches)) {
  write(rel, content);
  n++;
}
console.log(`Patched ${n} story files (partial batch).`);
