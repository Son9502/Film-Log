// Picking scans on a phone: from the Photos library or from Files (iCloud Drive,
// a lab's download, a scanner's folder). Both keep full quality.
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";

export interface PickedScan { name: string; uri: string }

/** Full quality, and on iOS the stored original (no HEIC → JPEG transcode) where possible. */
const PHOTO_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["images"],
  quality: 1,
  preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
};

export async function pickScansFromPhotos(multiple: boolean): Promise<PickedScan[] | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    ...PHOTO_OPTIONS,
    allowsMultipleSelection: multiple,
    orderedSelection: multiple,
  });
  if (result.canceled) return null;
  return result.assets.map((a, i) => ({ name: a.fileName ?? `photo_${i + 1}.jpg`, uri: a.uri }));
}

/** The original files, byte for byte, with their file names (useful for frame order). */
export async function pickScansFromFiles(multiple: boolean): Promise<PickedScan[] | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["image/*"],
    multiple,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  return result.assets.map((a) => ({ name: a.name, uri: a.uri }));
}
