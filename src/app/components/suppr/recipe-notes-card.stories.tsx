import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { http, HttpResponse } from "msw";
import { RecipeNotesCard } from "./recipe-notes-card";

const RECIPE_ID = "00000000-0000-4000-8000-000000000010";
const USER_ID = "00000000-0000-4000-8000-000000000011";

const meta = {
  title: "Suppr/RecipeNotesCard",
  component: RecipeNotesCard,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Personal notes + star rating card on recipe detail — debounced autosave to Supabase.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 440, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RecipeNotesCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SignedOut: Story = {
  name: "Signed out prompt",
  args: { recipeId: RECIPE_ID, userId: null },
};

export const WithExistingNotes: Story = {
  name: "With existing notes",
  args: { recipeId: RECIPE_ID, userId: USER_ID },
  parameters: {
    msw: {
      handlers: [
        http.get(/user_recipe_notes/, () =>
          HttpResponse.json({
            id: "note-1",
            user_id: USER_ID,
            recipe_id: RECIPE_ID,
            notes: "Less salt next time. Double the garlic.",
            personal_rating: 4,
            cook_count: 3,
            last_cooked_at: "2026-07-20T12:00:00.000Z",
            created_at: "2026-06-01T10:00:00.000Z",
            updated_at: "2026-07-20T12:00:00.000Z",
          }),
        ),
        http.post(/user_recipe_notes/, async ({ request }) =>
          HttpResponse.json(await request.json()),
        ),
        http.patch(/user_recipe_notes/, async ({ request }) =>
          HttpResponse.json(await request.json()),
        ),
      ],
    },
  },
};
