// ── Scan upload safeguards ───────────────────────────────────────────────────
// Checks a file before it's uploaded (empty, too big, not really an image),
// bounds how long an upload may take, retries once on a network hiccup, and
// turns storage errors into messages a person can act on.

/**
 * Largest scan accepted. Supabase's free plan caps each stored file at 50 MB; on a
 * paid plan raise the bucket's limit in the dashboard (Storage → scans) and this to match.
 */
export const MAX_SCAN_MB = 50;
/** ZIPs are unpacked in memory, so very large ones can crash the app on a phone. */
export const MAX_ZIP_MB = 500;

const MB = 1024 * 1024;
export const formatMb = (bytes: number) => `${(bytes / MB).toFixed(bytes < 10 * MB ? 1 : 0)} MB`;

export type ImageKind = "jpeg" | "png" | "tiff" | "heic";

const CONTENT_TYPE: Record<ImageKind, string> = {
  jpeg: "image/jpeg", png: "image/png", tiff: "image/tiff", heic: "image/heic",
};

const HEIF_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"]);

/** What the file really is, from its first bytes; null if it isn't a supported image. */
export function detectImageKind(head: Uint8Array): ImageKind | null {
  const b = head;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b.length >= 4 && ((b[0] === 0x49 && b[1] === 0x49 && (b[2] === 0x2a || b[2] === 0x2b) && b[3] === 0x00) ||
      (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0x00 && (b[3] === 0x2a || b[3] === 0x2b)))) return "tiff";
  if (b.length >= 12 && String.fromCharCode(b[4], b[5], b[6], b[7]) === "ftyp" &&
      HEIF_BRANDS.has(String.fromCharCode(b[8], b[9], b[10], b[11]))) return "heic";
  return null;
}

/** Content type from the file's bytes, falling back to its extension. */
export function scanContentType(ext: string, kind: ImageKind | null): string {
  if (kind) return CONTENT_TYPE[kind];
  const e = ext.toLowerCase();
  if (e === "jpg" || e === "jpeg") return "image/jpeg";
  if (e === "tif" || e === "tiff") return "image/tiff";
  if (e === "heic" || e === "heif") return "image/heic";
  return `image/${e || "jpeg"}`;
}

/** A problem with the file itself; retrying won't help. */
export class ScanFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScanFileError";
  }
}

/**
 * Throws a ScanFileError for an empty, oversized or non-image file. `head` is the
 * first bytes of the file; pass null if they couldn't be read (the check is skipped).
 */
export function checkScanFile(file: { size: number; head: Uint8Array | null }): ImageKind | null {
  if (file.size === 0) throw new ScanFileError("The file is empty (it may not have finished downloading).");
  if (file.size > MAX_SCAN_MB * MB) {
    throw new ScanFileError(`${formatMb(file.size)} is over the ${MAX_SCAN_MB} MB limit per scan. Export a smaller file (for example a JPEG) or raise the limit.`);
  }
  if (!file.head) return null;
  const kind = detectImageKind(file.head);
  if (!kind) throw new ScanFileError("This isn't a JPEG, PNG, TIFF or HEIC image (the file may be damaged).");
  return kind;
}

export function checkZipSize(name: string, size: number | null | undefined): void {
  if (size != null && size > MAX_ZIP_MB * MB) {
    throw new ScanFileError(`"${name}" is ${formatMb(size)}; ZIPs over ${MAX_ZIP_MB} MB can't be opened on this device. Split it into smaller ZIPs or pick the images directly.`);
  }
}

/** One minute, plus time for the file at a slow ~100 KB/s connection. */
export function uploadTimeoutMs(bytes: number): number {
  return 60_000 + Math.ceil(bytes / (100 * 1024)) * 1000;
}

export class UploadTimeoutError extends Error {
  constructor(ms: number) {
    super(`The upload took longer than ${Math.round(ms / 60_000) || 1} min and was stopped. Check your connection and retry.`);
    this.name = "UploadTimeoutError";
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new UploadTimeoutError(ms)), ms); }),
  ]).finally(() => clearTimeout(timer));
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e ?? ""));
const status = (e: unknown): number | undefined => {
  const s = (e as { statusCode?: unknown; status?: unknown } | null)?.statusCode ?? (e as { status?: unknown } | null)?.status;
  const n = typeof s === "string" ? parseInt(s, 10) : s;
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
};

/** Network drops, timeouts and server errors are worth one more try; file problems aren't. */
export function isRetryable(e: unknown): boolean {
  if (e instanceof ScanFileError) return false;
  if (e instanceof UploadTimeoutError) return true;
  const code = status(e);
  if (code !== undefined) return code >= 500 || code === 408 || code === 429;
  return /network|fetch|timed? ?out|socket|connection|offline|ECONN|aborted/i.test(message(e));
}

export async function withRetry<T>(fn: () => Promise<T>, delayMs = 2000): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (!isRetryable(e)) throw e;
    await new Promise((r) => setTimeout(r, delayMs));
    return fn();
  }
}

/** A storage or network error as something the user can act on. */
export function friendlyUploadError(e: unknown): string {
  const text = message(e);
  const code = status(e);
  if (e instanceof ScanFileError || e instanceof UploadTimeoutError) return text;
  if (code === 413 || /maximum allowed size|payload too large|too large/i.test(text)) {
    return `Too big for your storage's file size limit (${MAX_SCAN_MB} MB on Supabase's free plan).`;
  }
  if (/bucket not found/i.test(text)) return "The \"scans\" storage bucket doesn't exist yet. See Storage setup in the README.";
  if (code === 401 || code === 403 || /row-level security|unauthorized|jwt/i.test(text)) {
    return "Storage refused the upload. Sign out and back in, then retry.";
  }
  if (/mime type|invalid_mime/i.test(text)) return "The scans bucket doesn't accept this file type. Allow image/* in the bucket settings.";
  if (isRetryable(e)) return `Network problem (${text || "no response"}). Check your connection and retry.`;
  return text || "Something went wrong.";
}
