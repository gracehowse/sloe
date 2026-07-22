import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MethodologyNote, StepBody, StepHeader } from "./scaffold";

const meta = {
  title: "Suppr/Onboarding/Scaffold",
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ width: 390, background: "var(--bg)" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const StepHeaderDefault: Story = {
  render: () => (
    <StepBody>
      <StepHeader
        overline="Step 06 of 12"
        title="How old are you?"
        subtitle="Metabolic rate drops ~1% per decade after 20 — we'll factor that in."
      />
    </StepBody>
  ),
};

export const StepHeaderCompact: Story = {
  render: () => (
    <StepBody>
      <StepHeader
        overline="Step 10 of 12"
        title="How fast do you want to move?"
        subtitle="A sustainable pace keeps muscle and energy steadier."
        compact
      />
      <MethodologyNote>
        Sloe uses your pace to estimate a first target — then adapts from your actual logs after a couple of weeks.
      </MethodologyNote>
    </StepBody>
  ),
};
