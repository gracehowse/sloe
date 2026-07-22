import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { CoachCandidate } from "@suppr/nutrition-core/mealCoach";
import { mobileStoryFrame } from "../_mobileStoryDecorators";
import { CoachScreenView } from "./CoachScreenView";

const CANDIDATES: CoachCandidate[] = [
  {
    recipeId: "recipe-miso-salmon",
    title: "Miso salmon bowl",
    thumbnail: null,
    predictedCalories: 520,
    predictedProtein: 38,
    predictedCarbs: 42,
    predictedFat: 18,
    band: "close",
    bandLabel: "Close fit",
    whyLine: "Fits what you have left for dinner without overshooting protein.",
    score: 0.18,
    cookTimeMin: 25,
  },
  {
    recipeId: "recipe-chicken-tray",
    title: "Lemon herb chicken tray bake",
    thumbnail: null,
    predictedCalories: 610,
    predictedProtein: 44,
    predictedCarbs: 36,
    predictedFat: 24,
    band: "loose",
    bandLabel: "Roughly fits",
    whyLine: "Uses most of your remaining calories for the day.",
    score: 0.42,
  },
];

const meta = {
  title: "Mobile/Coach/CoachScreenView",
  component: CoachScreenView,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof CoachScreenView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithCandidates: Story = {
  args: {
    narrative: "You are 420 kcal under target with solid protein so far.",
    candidates: CANDIDATES,
    librarySize: 24,
    remainingCalories: 420,
    selectedChipId: null,
    askAnswer: null,
    askLoading: false,
    onAskChip: () => undefined,
  },
};

export const EmptyLibrary: Story = {
  args: {
    narrative: "Save a few recipes and I can suggest what to eat next.",
    candidates: [],
    librarySize: 0,
    remainingCalories: 600,
    selectedChipId: null,
    askAnswer: null,
    askLoading: false,
    onAskChip: () => undefined,
  },
};
