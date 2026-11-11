import piexif from "piexifjs";
import { zipSync, strToU8 } from "fflate";
import { Roll, Shot } from "@/types";
import { getScanUrl } from "@/services/supabase";

type Names = { film: (id: string) => string; camera: (id: string) => string };

type FrameMetadata = {
  rollId: string;
  rollName: string;
  frame: number;
  film: string;
  camera: string;
  iso: string;
  shutter?: string;
  aperture?: string;
  shotAt?: string;
  latitude?: number;
  longitude?: number;
  location?: string;
  notes?: string;
};

function safeName(value: string): string {
  return value.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "_") || "roll";
}

function rational(value: string | undefined, prefix = ""): [number, number] | undefined {
  if (!value) return undefined;
  const clean = value.trim().replace(new RegExp(`^${prefix}`), "");
  const fraction = clean.match(/^(\d+)\/(\d+)$/);
  if (fraction) return [Number(fraction[1]), Number(fraction[2])];
  const decimal = Number(clean);
  if (!Number.isFinite(decimal) || decimal <= 0) return undefined;
  const denominator = 10000;
  return [Math.round(decimal * denominator), denominator];
}

function exifDate(timestamp: string | undefined): string | undefined {
  if (!timestamp) return undefined;
  const date = new Date(timestamp.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return undefined;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}:${pad(date.getMonth() + 1)}:${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function exifText(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7e]/g, "?");
}

function bytesToBase64(bytes: Uint8Array): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let encoded = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const hasB = i + 1 < bytes.length;
    const hasC = i + 2 < bytes.length;
    const b = hasB ? bytes[i + 1] : 0;
    const c = hasC ? bytes[i + 2] : 0;
    encoded += alphabet[a >> 2];
    encoded += alphabet[((a & 3) << 4) | (b >> 4)];
    encoded += hasB ? alphabet[((b & 15) << 2) | (c >> 6)] : "=";
    encoded += hasC ? alphabet[c & 63] : "=";
  }
  return encoded;
}

function base64ToBytes(value: string): Uint8Array {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const clean = value.replace(/[^A-Za-z0-9+/]/g, "");
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let outputIndex = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = alphabet.indexOf(clean[i]);
    const b = alphabet.indexOf(clean[i + 1]);
    const c = clean[i + 2] ? alphabet.indexOf(clean[i + 2]) : 0;
    const d = clean[i + 3] ? alphabet.indexOf(clean[i + 3]) : 0;
    bytes[outputIndex++] = (a << 2) | (b >> 4);
    if (clean[i + 2] && clean[i + 2] !== "=") bytes[outputIndex++] = ((b & 15) << 4) | (c >> 2);
    if (clean[i + 3] && clean[i + 3] !== "=") bytes[outputIndex++] = ((c & 3) << 6) | d;
  }
  return bytes.slice(0, outputIndex);
}

function shotMetadata(roll: Roll, shot: Shot, names: Names): FrameMetadata {
  return {
    rollId: roll.id,
    rollName: roll.name || roll.id,
    frame: shot.frame,
    film: names.film(roll.filmStockId),
    camera: names.camera(roll.cameraId),
    iso: roll.iso,
    shutter: shot.shutter,
    aperture: shot.aperture,
    shotAt: shot.timestamp,
    latitude: shot.location?.latitude,
    longitude: shot.location?.longitude,
    location: shot.locationLabel ?? roll.locationLabel,
    notes: shot.notes,
  };
}

function addExif(jpeg: Uint8Array, metadata: FrameMetadata): Uint8Array {
  const imageData = `data:image/jpeg;base64,${bytesToBase64(jpeg)}`;
  const exif = piexif.load(imageData);
  const imageIfd = exif["0th"] ?? (exif["0th"] = {});
  const exifIfd = exif.Exif ?? (exif.Exif = {});
  const gpsIfd = exif.GPS ?? (exif.GPS = {});
  const camera = exifText(metadata.camera);
  const description = exifText(`${metadata.film} - ${metadata.rollName}`);
  imageIfd[piexif.ImageIFD.Model] = camera;
  imageIfd[piexif.ImageIFD.ImageDescription] = description;
  const iso = Number(metadata.iso);
  if (Number.isFinite(iso) && iso > 0) exifIfd[piexif.ExifIFD.ISOSpeedRatings] = Math.round(iso);

  const date = exifDate(metadata.shotAt);
  if (date) {
    exifIfd[piexif.ExifIFD.DateTimeOriginal] = date;
    exifIfd[piexif.ExifIFD.DateTimeDigitized] = date;
  }
  const exposure = rational(metadata.shutter);
  if (exposure) exifIfd[piexif.ExifIFD.ExposureTime] = exposure;
  const fNumber = rational(metadata.aperture, "^f\\s*/\\s*");
  if (fNumber) exifIfd[piexif.ExifIFD.FNumber] = fNumber;

  if (metadata.latitude != null && metadata.longitude != null) {
    gpsIfd[piexif.GPSIFD.GPSLatitudeRef] = metadata.latitude < 0 ? "S" : "N";
    gpsIfd[piexif.GPSIFD.GPSLatitude] = piexif.GPSHelper.degToDmsRational(Math.abs(metadata.latitude));
    gpsIfd[piexif.GPSIFD.GPSLongitudeRef] = metadata.longitude < 0 ? "W" : "E";
    gpsIfd[piexif.GPSIFD.GPSLongitude] = piexif.GPSHelper.degToDmsRational(Math.abs(metadata.longitude));
  }

  const output = piexif.insert(piexif.dump(exif), imageData);
  const base64 = output.slice(output.indexOf(",") + 1);
  return base64ToBytes(base64);
}

function extension(path: string): string {
  return path.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
}

export async function buildScanArchive(
  rolls: Roll[],
  names: Names,
): Promise<{ bytes: Uint8Array; scanCount: number }> {
  const files: Record<string, Uint8Array> = {};
  const index: FrameMetadata[] = [];
  let scanCount = 0;

  for (const roll of rolls) {
    for (const shot of roll.shots) {
      if (!shot.scanUri) continue;
      const metadata = shotMetadata(roll, shot, names);
      const response = await fetch(await getScanUrl(shot.scanUri));
      if (!response.ok) throw new Error(`Could not download scan for ${roll.id}, frame ${shot.frame}.`);
      const original = new Uint8Array(await response.arrayBuffer());
      const ext = extension(shot.scanUri);
      const folder = `${safeName(roll.name || roll.id)}-${safeName(roll.id)}`;
      const fileName = `frame-${String(shot.frame).padStart(3, "0")}.${ext || "jpg"}`;
      const filePath = `${folder}/${fileName}`;
      files[filePath] = ext === "jpg" || ext === "jpeg" ? addExif(original, metadata) : original;
      index.push(metadata);
      scanCount++;
    }
  }

  if (scanCount === 0) throw new Error("There are no scans to export.");
  files["metadata.json"] = strToU8(JSON.stringify(index, null, 2));
  return { bytes: zipSync(files, { level: 0 }), scanCount };
}
