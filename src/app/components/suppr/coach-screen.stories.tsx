import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { CoachCandidate } from "@/lib/nutrition/mealCoach";
import { CoachScreen } from "./coach-screen";

const CANDIDATES: CoachCandidate[] = [
  {
    recipeId: "recipe-miso-salmon",
    title: "Miso salmon bowl",
    thumbnail: "https://images.unsplash.com/photo-1467003909583-e00203781689?w=120&h=120&fit=crop",
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
  title: "Suppr/CoachScreen",
  component: CoachScreen,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Full Coach destination — today's read, ranked what-to-eat-next, and ask-the-coach chips.",
      },
    },
  },
  args: {
    narrative:
      "You are 420 kcal under target with solid protein so far — a balanced dinner keeps the day on track.",
    candidates: CANDIDATES,
    librarySize: 24,
    remainingCalories: 420,
    selectedChipId: null,
    askAnswer: null,
    askLoading: false,
    onCandidatePress: () => undefined,
    onAskChip: () => undefined,
  },
} satisfies Meta<typeof CoachScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithSuggestions: Story = {};

export const LoadingNarrative: Story = {
  args: {
    narrativeLoading: true,
    candidates: [],
    librarySize: 24,
    remainingCalories: 420,
  },
};

export const AskAnswerVisible: Story = {
  args: {
    selectedChipId: "high_protein_snack",
    askAnswer:
      "You have about 38 g of protein left for the day. A salmon bowl or chicken tray bake would land you close to target.",
  },
};
