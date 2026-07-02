"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * ENG-1310 — shared live-camera barcode scanner (web).
 *
 * Wraps the native `BarcodeDetector` API + `getUserMedia` in a hook so
 * every web barcode surface offers REAL scanning where the browser
 * supports it (Chrome/Edge desktop + Android, Safari 17+ behind flag),
 * with an honest error string where it doesn't. Extracted from the
 * inline implementation in `RecipeUpload.tsx` (now a consumer) so the
 * Today "Scan barcode" dialog shares one proven detect loop.
 *
 * Contract:
 *  - `supported` is computed on the client after mount (SSR-safe).
 *  - `start()` requests the environment-facing camera and runs a rAF
 *    detect loop against `videoRef`; the first 8+ digit hit stops the
 *    stream and fires `onDetected(code)`.
 *  - `stop()` (and unmount) tears down the stream + loop. Idempotent.
 *  - Errors (unsupported browser, camera denied) land in `scannerError`
 *    as user-facing copy — never thrown, never raw.
 */

type BarcodeDetectorCtor = new (opts: { formats: string[] }) => {
  detect: (video: HTMLVideoElement) => Promise<{ rawValue?: string }[]>;
};

const SCAN_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "qr_code"];

export const SCANNER_UNSUPPORTED_COPY =
  "Barcode scanning isn't supported in this browser. Enter the barcode instead.";

function detectorCtor(): BarcodeDetectorCtor | undefined {
  return (globalThis as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
}

export function useBarcodeDetectorScanner(onDetected: (code: string) => void) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  // Client-only capability probe (SSR renders no camera affordance).
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    setSupported(Boolean(detectorCtor()) && Boolean(navigator.mediaDevices?.getUserMedia));
  }, []);

  const stop = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    setScanning(false);
  }, []);

  const start = useCallback(async () => {
    setScannerError(null);
    stop();
    const Ctor = detectorCtor();
    if (!Ctor) {
      setScannerError(SCANNER_UNSUPPORTED_COPY);
      return;
    }
    const el = videoRef.current;
    if (!el) {
      setScannerError("Scanner not ready. Try again.");
      return;
    }
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      el.srcObject = stream;
      await el.play();
    } catch (e) {
      setScannerError(e instanceof Error ? e.message : "Camera permission denied");
      if (stream) stream.getTracks().forEach((t) => t.stop());
      return;
    }

    const detector = new Ctor({ formats: SCAN_FORMATS });
    let stopped = false;
    let raf = 0;

    const teardown = () => {
      stopped = true;
      cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (el.srcObject) el.srcObject = null;
    };
    stopRef.current = teardown;
    setScanning(true);

    const loop = async () => {
      if (stopped) return;
      try {
        const codes = await detector.detect(el);
        const raw = codes?.[0]?.rawValue?.replace(/\D/g, "") ?? "";
        if (raw.length >= 8) {
          teardown();
          stopRef.current = null;
          setScanning(false);
          onDetectedRef.current(raw);
          return;
        }
      } catch {
        // transient detector errors (tab hidden, frame not ready) — keep looping
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
  }, [stop]);

  useEffect(() => () => stop(), [stop]);

  return { videoRef, scannerError, scanning, supported, start, stop };
}
