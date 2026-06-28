export type BarcodeContributionStatus = "pending" | "verified" | "rejected" | string;

export interface BarcodeContributionSummary {
  id: string;
  barcode: string;
  name: string;
  brand: string | null;
  verification_status: BarcodeContributionStatus | null;
  upvotes: number | null;
  downvotes: number | null;
  updated_at: string | null;
  created_at: string | null;
}

export const BARCODE_CONTRIBUTIONS_SETTINGS_LABEL = "Barcode contributions";

export const BARCODE_CONTRIBUTIONS_SETTINGS_SUB =
  "Remove products you shared to the community database.";

export const BARCODE_CONTRIBUTIONS_PRIVACY_COPY =
  "When you correct or add a barcode product, Sloe stores the product data with your account as the submitter so you can withdraw it later from Settings.";

export function barcodeContributionTitle(item: Pick<BarcodeContributionSummary, "name" | "brand" | "barcode">): string {
  const name = item.name.trim();
  const brand = item.brand?.trim();
  if (brand) return `${brand} · ${name || item.barcode}`;
  return name || item.barcode;
}

export function barcodeContributionStatusLabel(status: BarcodeContributionStatus | null | undefined): string {
  switch (status) {
    case "verified":
      return "Verified";
    case "rejected":
      return "Rejected";
    case "pending":
    case null:
    case undefined:
      return "Pending review";
    default:
      return status.replace(/_/g, " ");
  }
}

export function barcodeContributionsCountLabel(count: number): string {
  if (count === 0) return "No shared barcode products";
  if (count === 1) return "1 shared barcode product";
  return `${count} shared barcode products`;
}
