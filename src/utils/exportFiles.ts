import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const saveZipFile = (name: string, bytes: Uint8Array) => saveBinaryFile(name, bytes, "application/zip");

/** A browser download on web, the share sheet on native. */
export async function saveBinaryFile(name: string, bytes: Uint8Array, mimeType: string): Promise<void> {
  if (Platform.OS === "web") {
    const blobBytes = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const url = URL.createObjectURL(new Blob([blobBytes], { type: mimeType }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }

  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(bytes);
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: name });
}

export async function saveJsonFile(name: string, content: string): Promise<void> {
  if (Platform.OS === "web") {
    const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
    try {
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.click();
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    return;
  }

  if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing is unavailable on this device.");
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  try {
    file.write(content);
    await Sharing.shareAsync(file.uri, { mimeType: "application/json", dialogTitle: name });
  } finally {
    if (file.exists) file.delete();
  }
}
