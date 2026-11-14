import { createClient } from "@supabase/supabase-js";
import {
  ImageKind, ScanFileError, checkScanFile, scanContentType, uploadTimeoutMs, withRetry, withTimeout,
} from "@/utils/scanUploadSafety";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// ── Supabase project values come from .env (see .env.example) ────────────────
// Found in: Supabase Dashboard → Project Settings → API
// Expo inlines EXPO_PUBLIC_* at build time, so these must be read as literal
// `process.env.EXPO_PUBLIC_…` expressions (no destructuring).
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing Supabase config. Copy .env.example to .env and set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, then restart Expo with `npx expo start -c`.",
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,         // Persist session on device
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === "web",  // true on web (parses reset/magic-link tokens from URL), false on native
  },
});

// ── Auth helpers ──────────────────────────────────────────────────────────────
export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function resetPassword(email: string, redirectTo?: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(
    email,
    redirectTo ? { redirectTo } : undefined,
  );
  if (error) throw error;
}

export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

// ── Storage helpers ───────────────────────────────────────────────────────────

export async function uploadScan(
  userId: string,
  rollId: string,
  shotId: string,
  localUri: string,
): Promise<string> {
  const ext = scanExtFromUri(localUri);
  const response = await fetch(localUri);
  if (!response.ok) throw new ScanFileError(`Could not read the file (HTTP ${response.status}).`);
  const blob = await response.blob();
  const kind = checkScanFile({ size: blob.size, head: await readHead(blob) });
  return uploadScanData(userId, rollId, shotId, blob, ext, kind, blob.size);
}

/** Uploads checked scan data (a Blob, or bytes on web) with a timeout and one retry. */
export async function uploadScanData(
  userId: string, rollId: string, shotId: string,
  data: Blob | Uint8Array, ext: string, kind: ImageKind | null, size: number,
): Promise<string> {
  const path = `${userId}/${rollId}/${shotId}.${ext}`;
  const timeout = uploadTimeoutMs(size);
  await withRetry(async () => {
    const { error } = await withTimeout(
      supabase.storage.from("scans").upload(path, data, { contentType: scanContentType(ext, kind), upsert: true }),
      timeout,
    );
    if (error) throw error;
  });
  return path;
}

/** "file:///…/frame.TIF?x=1" → "tif"; "jpg" when there's no usable extension. */
export function scanExtFromUri(uri: string): string {
  const ext = uri.split("?")[0].split("#")[0].split("/").pop()?.split(".").slice(1).pop()?.toLowerCase();
  return ext && /^[a-z0-9]{2,5}$/.test(ext) ? ext : "jpg";
}

/** The first bytes of a Blob, or null if this platform can't read them (the content check is then skipped). */
async function readHead(blob: Blob): Promise<Uint8Array | null> {
  try {
    const part = blob.slice(0, 16);
    if (typeof part.arrayBuffer === "function") return new Uint8Array(await part.arrayBuffer());
    return await new Promise<Uint8Array>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(part);
    });
  } catch {
    return null;
  }
}

export async function getScanUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from("scans").createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteScan(path: string): Promise<void> {
  const { error } = await supabase.storage.from("scans").remove([path]);
  if (error) throw error;
}

// Checks whether each stored scan responds to a HEAD request; this does not verify its contents.
export async function verifyScans(
  paths: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<string[]> {
  const failed: string[] = [];
  let done = 0;
  let next = 0;
  async function worker() {
    while (next < paths.length) {
      const path = paths[next++];
      try {
        const url = await getScanUrl(path);
        const res = await fetch(url, { method: "HEAD" });
        if (!res.ok) failed.push(path);
      } catch {
        failed.push(path);
      }
      onProgress?.(++done, paths.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(5, paths.length) }, worker));
  return failed;
}

export async function uploadAvatar(userId: string, localUri: string): Promise<string> {
  const ext = localUri.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${userId}/avatar.${ext}`;
  const response = await fetch(localUri);
  const blob = await response.blob();
  const { error } = await supabase.storage.from("avatars").upload(path, blob, {
    contentType: ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`,
    upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}
