/** Storybook stub — camera is unavailable on Chromatic web. */
import * as React from "react";
import { View, type ViewProps } from "react-native";

export type CameraViewProps = ViewProps & {
  facing?: string;
  barcodeScannerSettings?: unknown;
  onBarcodeScanned?: (event: { data: string; type: string }) => void;
};

export function CameraView(props: CameraViewProps) {
  const { facing: _f, barcodeScannerSettings: _b, onBarcodeScanned: _o, ...rest } = props;
  return <View {...rest} />;
}

export function useCameraPermissions(): [
  { granted: boolean; canAskAgain: boolean; status: string } | null,
  () => Promise<{ granted: boolean }>,
] {
  return [{ granted: false, canAskAgain: false, status: "denied" }, async () => ({ granted: false })];
}

export default { CameraView, useCameraPermissions };
