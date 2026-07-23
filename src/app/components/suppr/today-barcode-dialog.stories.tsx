import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TodayBarcodeDialog } from "./today-barcode-dialog";
import type { OffProductMacros } from "../../../lib/openFoodFacts/fetchProductByBarcode";

const noop = () => undefined;

const sampleProduct: OffProductMacros = {
  name: "Greek yogurt 0%",
  calories: 59,
  protein: 10,
  carbs: 3.6,
  fat: 0.4,
  fiberG: 0,
  sugarG: 3.2,
  sodiumMg: 36,
  servingLabel: "100 g",
  servingSizeG: 100,
  servingOptions: [{ label: "100 g", grams: 100 }],
};

const baseArgs = {
  open: true,
  onOpenChange: noop,
  barcodeValue: "",
  onBarcodeValueChange: noop,
  barcodeBusy: false,
  onBarcodeBusyChange: noop,
  barcodePreview: null as OffProductMacros | null,
  onBarcodePreviewChange: noop,
  barcodeGramsStr: "170",
  onBarcodeGramsStrChange: noop,
  barcodeGramsParsed: 170,
  barcodeTitleOverride: "",
  onBarcodeTitleOverrideChange: noop,
  barcodeMacrosManual: false,
  onBarcodeMacrosManualChange: noop,
  barcodeEditCal: "100",
  onBarcodeEditCalChange: noop,
  barcodeEditPro: "17",
  onBarcodeEditProChange: noop,
  barcodeEditCarb: "6",
  onBarcodeEditCarbChange: noop,
  barcodeEditFat: "1",
  onBarcodeEditFatChange: noop,
  mealSlot: "Lunch",
  onMealSlotChange: noop,
  recentFoods: ["Chicken rice bowl", "Greek yogurt"],
  onPickRecentFood: noop,
  onConfirm: noop,
  onPhotoFallback: noop,
  onAddAsCustomFood: noop,
};

const meta = {
  title: "Suppr/TodayBarcodeDialog",
  component: TodayBarcodeDialog,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: baseArgs,
} satisfies Meta<typeof TodayBarcodeDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Lookup: Story = {
  args: { barcodeValue: "5000159484695" },
};

export const ReviewProduct: Story = {
  args: {
    barcodeValue: "5000159484695",
    barcodePreview: sampleProduct,
    barcodeTitleOverride: sampleProduct.name,
    barcodeEditCal: "100",
    barcodeEditPro: "17",
    barcodeEditCarb: "6",
    barcodeEditFat: "1",
  },
};
