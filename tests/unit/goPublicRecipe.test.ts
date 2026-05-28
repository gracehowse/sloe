import { describe, expect, it } from "vitest";

import {
  GO_PUBLIC_ALERT_MESSAGE,
  GO_PUBLIC_ALERT_TITLE,
  GO_PUBLIC_ATTESTATION_LABEL,
  GO_PUBLIC_DIALOG_TITLE,
  UNPUBLISH_ALERT_MESSAGE,
  UNPUBLISH_ALERT_TITLE,
  goPublicDialogDescription,
  updateRecipePublishedStatus,
} from "../../src/lib/recipes/goPublic";

describe("goPublic shared copy", () => {
  it("uses the create-flow attestation line on mobile alerts", () => {
    expect(GO_PUBLIC_ALERT_TITLE).toBe("Publish to community?");
    expect(GO_PUBLIC_ALERT_MESSAGE).toContain(GO_PUBLIC_ATTESTATION_LABEL);
    expect(GO_PUBLIC_ALERT_MESSAGE).toContain("Discover");
  });

  it("web dialog copy names the recipe", () => {
    expect(GO_PUBLIC_DIALOG_TITLE).toBe("Publish this recipe?");
    expect(goPublicDialogDescription("Pasta")).toContain("Pasta");
  });

  it("unpublish copy matches web RecipeDetail", () => {
    expect(UNPUBLISH_ALERT_TITLE).toBe("Unpublish this recipe?");
    expect(UNPUBLISH_ALERT_MESSAGE).toContain("private draft");
  });
});

describe("updateRecipePublishedStatus", () => {
  it("updates published flag scoped to author_id", async () => {
    const calls: unknown[] = [];
    const supabase = {
      from(table: string) {
        calls.push(["from", table]);
        return {
          update(payload: { published: boolean }) {
            calls.push(["update", payload]);
            return {
              eq(col: string, val: string) {
                calls.push(["eq", col, val]);
                return {
                  async eq(col2: string, val2: string) {
                    calls.push(["eq", col2, val2]);
                    return { error: null };
                  },
                };
              },
            };
          },
        };
      },
    };

    const out = await updateRecipePublishedStatus(supabase as never, {
      recipeId: "r1",
      authorId: "u1",
      published: true,
    });
    expect(out).toEqual({ ok: true });
    expect(calls).toEqual([
      ["from", "recipes"],
      ["update", { published: true }],
      ["eq", "id", "r1"],
      ["eq", "author_id", "u1"],
    ]);
  });

  it("surfaces Supabase errors", async () => {
    const supabase = {
      from() {
        return {
          update() {
            return {
              eq() {
                return {
                  async eq() {
                    return { error: { message: "RLS denied" } };
                  },
                };
              },
            };
          },
        };
      },
    };
    const out = await updateRecipePublishedStatus(supabase as never, {
      recipeId: "r1",
      authorId: "u1",
      published: false,
    });
    expect(out).toEqual({ ok: false, message: "RLS denied" });
  });
});
