#!/usr/bin/env python3
"""Generate remaining mobile Phase 4 Storybook stories."""
from __future__ import annotations
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
NOOP = "() => undefined"

SKIP_RECIPE = {
    "RecipeActionPills", "SloeImageNotice", "RecipeMetaRow", "RecipeDetailLoadingSkeleton",
    "RecipeImportReviewBanner", "RecipeStandfirst", "RecipeMethodSteps", "RecipeMacroStrip",
}

def theme_path(rel_dir: str) -> str:
    depth = len(rel_dir.split("/"))
    return "../" * depth + ".storybook/stubs/mobile-theme"

def render(title: str, component: str, import_lines: str, body: str, depth: int = 3) -> str:
    tp = theme_path("apps/mobile/components/" + ("x/" * depth).rstrip("/") if depth > 3 else "recipe")
    # depth from file dir segment count under components/
    parts = title.split("/")
    # infer depth from rel dir passed separately
    return body  # placeholder

def story_file(rel_dir: str, title: str, component: str, imp: str, meta_extra: str, stories: str, default_export=False) -> str:
    depth = len(rel_dir.split("/"))
    tp = "../" * depth + ".storybook/stubs/mobile-theme"
    comp_ref = component
    return f"""import type {{ Meta, StoryObj }} from "@storybook/nextjs-vite";
{imp}import {{ MobileStoryThemeProvider }} from "{tp}";

const meta = {{
  title: "{title}",
  component: {comp_ref},
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <MobileStoryThemeProvider>
        <div style={{ {{ width: 360, padding: 16, background: "#F7F6FA" }} }}>
          <Story />
        </div>
      </MobileStoryThemeProvider>
    ),
  ],
  parameters: {{ layout: "fullscreen" }},
  {meta_extra}
}} satisfies Meta<typeof {comp_ref}>;

export default meta;
type Story = StoryObj<typeof meta>;

{stories}
"""

def onboarding_step(title: str, file_base: str, export_name: str, step_id: str, initial_extra: str = "") -> str:
    depth = len("apps/mobile/components/onboarding/steps".split("/"))
    tp = "../" * depth + ".storybook/stubs/mobile-theme"
    init = f'onboardingStoryInitial("{step_id}", {initial_extra or "{}"})'
    return f"""import type {{ Meta, StoryObj }} from "@storybook/nextjs-vite";
import {{ OnboardingStoryFrame }} from "../_storyShell";
import {{ onboardingStoryInitial }} from "../_storyFixtures";
import {{ {export_name} }} from "./{file_base}";

const meta = {{
  title: "Mobile/Onboarding/Steps/{title}",
  component: {export_name},
  tags: ["autodocs"],
  parameters: {{ layout: "fullscreen" }},
  decorators: [
    (Story) => (
      <OnboardingStoryFrame initial={{{init}}}>
        <Story />
      </OnboardingStoryFrame>
    ),
  ],
}} satisfies Meta<typeof {export_name}>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {{}};
export const Prefilled: Story = {{}};
"""

def write(rel: str, content: str, skip=False):
    path = ROOT / rel
    if skip and path.exists():
        return "skip"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)
    return "write"

created = []
skipped = []

