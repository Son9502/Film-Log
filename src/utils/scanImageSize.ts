import { Image } from "react-native";

export function readScanImageSize(
  uri: string,
  onSize: (size: { width: number; height: number }) => void,
): () => void {
  let cancelled = false;
  Image.getSize(uri, (width, height) => {
    if (cancelled) return;
    if (width > 0 && height > 0) onSize({ width, height });
    else console.error("Could not read scan dimensions: invalid image size.");
  }, (error) => {
    if (!cancelled) console.error("Could not read scan dimensions:", error);
  });
  return () => { cancelled = true; };
}
