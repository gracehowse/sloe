import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./accordion";

const meta = {
  component: Accordion,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Collapsible FAQ / section stack built on Radix Accordion. One item open at a time by default (`type=\"single\"`).",
      },
    },
  },
} satisfies Meta<typeof Accordion>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    type: "single",
    collapsible: true,
    className: "w-full max-w-md",
    children: (
      <>
        <AccordionItem value="macros">
          <AccordionTrigger>How are macros calculated?</AccordionTrigger>
          <AccordionContent>
            Totals roll up from verified ingredient matches; low-confidence rows are flagged for review.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="sync">
          <AccordionTrigger>Does Health sync overwrite logs?</AccordionTrigger>
          <AccordionContent>
            Wearable steps and workouts fill gaps — they never replace meals you logged yourself.
          </AccordionContent>
        </AccordionItem>
      </>
    ),
  },
};

export const OpenItem: Story = {
  args: {
    type: "single",
    collapsible: true,
    defaultValue: "macros",
    className: "w-full max-w-md",
    children: (
      <>
        <AccordionItem value="macros">
          <AccordionTrigger>How are macros calculated?</AccordionTrigger>
          <AccordionContent>
            Totals roll up from verified ingredient matches; low-confidence rows are flagged for review.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="sync">
          <AccordionTrigger>Does Health sync overwrite logs?</AccordionTrigger>
          <AccordionContent>
            Wearable steps and workouts fill gaps — they never replace meals you logged yourself.
          </AccordionContent>
        </AccordionItem>
      </>
    ),
  },
};
