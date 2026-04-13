import type { ComponentProps, ComponentType } from "react";
import { CameraView } from "expo-camera";

/** expo-camera's types omit barcode props; they work at runtime on supported builds. */
export type BarcodeCameraViewProps = ComponentProps<typeof CameraView> & {
  barcodeScannerEnabled?: boolean;
  barcodeScannerSettings?: { barcodeTypes: string[] };
  onBarcodeScanned?: (e: { data: string }) => void | Promise<void>;
};

export const BarcodeCameraView = CameraView as ComponentType<BarcodeCameraViewProps>;
