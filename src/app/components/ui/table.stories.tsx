import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";

const meta = {
  component: Table,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Semantic HTML table primitives with consistent cell/header padding. Prefer for dense data (macros, shopping) rather than card lists.",
      },
    },
  },
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Table>
      <TableCaption>Today’s macros</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Meal</TableHead>
          <TableHead>Protein</TableHead>
          <TableHead>Carbs</TableHead>
          <TableHead className="text-right">kcal</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>Breakfast</TableCell>
          <TableCell>28g</TableCell>
          <TableCell>42g</TableCell>
          <TableCell className="text-right">420</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Lunch</TableCell>
          <TableCell>36g</TableCell>
          <TableCell>48g</TableCell>
          <TableCell className="text-right">580</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
};

export const EmptyBody: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Item</TableHead>
          <TableHead className="text-right">Qty</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell colSpan={2} className="text-center text-muted-foreground">
            No items yet
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
};
