import {
  MAX_SCAN_MB, ScanFileError, UploadTimeoutError, checkScanFile, checkZipSize, detectImageKind,
  friendlyUploadError, isRetryable, scanContentType, uploadTimeoutMs, withRetry, withTimeout,
} from "./scanUploadSafety";

const bytes = (...b: number[]) => new Uint8Array([...b, ...Array(16).fill(0)].slice(0, 16));
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
const MB = 1024 * 1024;

describe("detectImageKind", () => {
  it("recognises scans by their first bytes", () => {
    expect(detectImageKind(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("jpeg");
    expect(detectImageKind(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("png");
    expect(detectImageKind(bytes(0x49, 0x49, 0x2a, 0x00))).toBe("tiff");
    expect(detectImageKind(bytes(0x4d, 0x4d, 0x00, 0x2a))).toBe("tiff");
    expect(detectImageKind(bytes(0, 0, 0, 0x18, ...ascii("ftypheic")))).toBe("heic");
  });
  it("rejects anything else", () => {
    expect(detectImageKind(bytes(...ascii("PK")))).toBeNull(); // a ZIP renamed .jpg
    expect(detectImageKind(bytes(...ascii("<html>")))).toBeNull();
    expect(detectImageKind(new Uint8Array())).toBeNull();
  });
});

describe("checkScanFile", () => {
  const jpeg = bytes(0xff, 0xd8, 0xff);
  it("accepts a real image and returns its kind", () => {
    expect(checkScanFile({ size: 5 * MB, head: jpeg })).toBe("jpeg");
  });
  it("rejects empty, oversized and non-image files", () => {
    expect(() => checkScanFile({ size: 0, head: jpeg })).toThrow(/empty/);
    expect(() => checkScanFile({ size: (MAX_SCAN_MB + 1) * MB, head: jpeg })).toThrow(/limit/);
    expect(() => checkScanFile({ size: 100, head: bytes(...ascii("PK")) })).toThrow(ScanFileError);
  });
  it("skips the content check when the bytes couldn't be read", () => {
    expect(checkScanFile({ size: 100, head: null })).toBeNull();
  });
  it("limits ZIP size", () => {
    expect(() => checkZipSize("big.zip", 600 * MB)).toThrow(/big\.zip/);
    expect(() => checkZipSize("ok.zip", 10 * MB)).not.toThrow();
    expect(() => checkZipSize("unknown.zip", undefined)).not.toThrow();
  });
});

describe("content types", () => {
  it("uses the bytes first, then the extension", () => {
    expect(scanContentType("jpg", "heic")).toBe("image/heic");
    expect(scanContentType("tif", null)).toBe("image/tiff");
    expect(scanContentType("JPG", null)).toBe("image/jpeg");
  });
});

describe("timeouts and retries", () => {
  it("allows more time for bigger files", () => {
    expect(uploadTimeoutMs(0)).toBe(60_000);
    expect(uploadTimeoutMs(50 * MB)).toBeGreaterThan(8 * 60_000);
  });
  it("times out a stalled upload", async () => {
    await expect(withTimeout(new Promise(() => {}), 10)).rejects.toBeInstanceOf(UploadTimeoutError);
    await expect(withTimeout(Promise.resolve(1), 1000)).resolves.toBe(1);
  });
  it("retries network problems once, not file problems", async () => {
    let calls = 0;
    await expect(withRetry(async () => { if (++calls === 1) throw new Error("Network request failed"); return "ok"; }, 0)).resolves.toBe("ok");
    expect(calls).toBe(2);
    calls = 0;
    await expect(withRetry(async () => { calls++; throw new ScanFileError("bad"); }, 0)).rejects.toThrow("bad");
    expect(calls).toBe(1);
  });
  it("classifies errors", () => {
    expect(isRetryable({ statusCode: "503", message: "x" })).toBe(true);
    expect(isRetryable({ statusCode: 413, message: "x" })).toBe(false);
    expect(isRetryable(new UploadTimeoutError(1000))).toBe(true);
  });
});

describe("friendlyUploadError", () => {
  it("explains storage errors", () => {
    expect(friendlyUploadError({ statusCode: "413", message: "Payload too large" })).toMatch(/file size limit/);
    expect(friendlyUploadError(new Error("Bucket not found"))).toMatch(/scans/);
    expect(friendlyUploadError(new Error("new row violates row-level security policy"))).toMatch(/Sign out/);
    expect(friendlyUploadError(new Error("Network request failed"))).toMatch(/connection/);
  });
});
