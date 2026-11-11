import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

// Saves each CSV: a browser download on web, the share sheet on native.
export async function saveCsvFiles(files: { name: string; content: string }[]): Promise<void> {
  for (const f of files) {
    if (Platform.OS === "web") {
      const url = URL.createObjectURL(new Blob([f.content], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = f.name;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const file = new File(Paths.cache, f.name);
      if (file.exists) file.delete();
      file.create();
      file.write(f.content);
      await Sharing.shareAsync(file.uri, { mimeType: "text/csv", dialogTitle: f.name });
    }
  }
}

export async function saveZipFile(name: string, bytes: Uint8Array): Promise<void> {
  if (Platform.OS === "web") {
    const blobBytes = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const url = URL.createObjectURL(new Blob([blobBytes], { type: "application/zip" }));
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
  await Sharing.shareAsync(file.uri, { mimeType: "application/zip", dialogTitle: name });
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
