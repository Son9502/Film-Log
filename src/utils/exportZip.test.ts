import { strFromU8, unzipSync } from "fflate";
import piexif from "piexifjs";
import { Roll } from "@/types";
import { buildScanArchive } from "./exportZip";

jest.mock("@/services/supabase", () => ({
  getScanUrl: jest.fn(async (path: string) => path),
}));

describe("buildScanArchive", () => {
  it("includes downloaded scans and frame metadata in the ZIP", async () => {
    const scanBytes = new Uint8Array([1, 2, 3]);
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      arrayBuffer: async () => scanBytes.buffer,
    } as Response)) as typeof fetch;

    const roll = {
      id: "roll-1",
      name: "Coast trip",
      filmStockId: "film-1",
      cameraId: "camera-1",
      iso: "400",
      frameCount: 36,
      status: "Archived",
      loadedAt: "2026-01-01",
      shots: [{
        id: "shot-1",
        frame: 2,
        scanUri: "roll-1/shot-1.png",
        timestamp: "2026-01-02 12:30",
        shutter: "1/250",
        aperture: "f/2.8",
        location: { latitude: 47.6, longitude: -122.3 },
      }],
      createdAt: "",
      updatedAt: "",
    } as Roll;

    const archive = await buildScanArchive([roll], {
      film: () => "Film 400",
      camera: () => "Camera Model",
    });
    const files = unzipSync(archive.bytes);

    expect(archive.scanCount).toBe(1);
    expect(Array.from(files["Coast_trip-roll-1/frame-002.png"])).toEqual([1, 2, 3]);
    expect(JSON.parse(strFromU8(files["metadata.json"]))).toMatchObject([{
      rollName: "Coast trip",
      frame: 2,
      film: "Film 400",
      camera: "Camera Model",
      iso: "400",
      latitude: 47.6,
      longitude: -122.3,
    }]);
  });

  it("rejects archives with no scans", async () => {
    await expect(buildScanArchive([], { film: (id) => id, camera: (id) => id }))
      .rejects.toThrow("There are no scans to export.");
  });

  it("writes frame details and GPS into exported JPEG EXIF", async () => {
    const jpegBase64 = "/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAAaADAAQAAAABAAAAAQAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgAAQABAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ4eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMAAgICAgICAwICAwUDAwMFBgUFBQUGCAYGBgYGCAoICAgICAgKCgoKCgoKCgwMDAwMDAwODg4ODw8PDw8PDw8PD//bAEMBAgICBAQEBwQEBxALCQsQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEP/dAAQAAf/aAAwDAQACEQMRAD8A/fyiiigD/9k=";
    const jpegFixture = jpegBase64
      .replace("dXZ4eHl6", "dXZ3eHl6")
      .replace("MDAwODg4ODw", "MDA4ODg4ODw")
      .replace("QEBAQEP/dAAQ", "QEBAQEBAQEP/dAAQ");
    const jpegBytes = Uint8Array.from(atob(jpegFixture), (char) => char.charCodeAt(0));
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      arrayBuffer: async () => jpegBytes.buffer,
    } as Response)) as typeof fetch;
    const roll = {
      id: "roll-2",
      name: "Night walk",
      filmStockId: "film-2",
      cameraId: "camera-2",
      iso: "800",
      frameCount: 36,
      status: "Archived",
      loadedAt: "2026-01-01",
      shots: [{
        id: "shot-2",
        frame: 7,
        scanUri: "roll-2/shot-2.jpg",
        timestamp: "2026-01-02 12:30",
        shutter: "1/250",
        aperture: "f/2.8",
        location: { latitude: 47.6, longitude: -122.3 },
      }],
      createdAt: "",
      updatedAt: "",
    } as Roll;

    const archive = await buildScanArchive([roll], {
      film: () => "Film 800",
      camera: () => "Camera Model",
    });
    const files = unzipSync(archive.bytes);
    const exportedBase64 = btoa(String.fromCharCode(...files["Night_walk-roll-2/frame-007.jpg"]));
    const exif = piexif.load(`data:image/jpeg;base64,${exportedBase64}`);

    expect(exif["0th"]?.[piexif.ImageIFD.Model]).toBe("Camera Model");
    expect(exif["0th"]?.[piexif.ImageIFD.ImageDescription]).toBe("Film 800 - Night walk");
    expect(exif.Exif?.[piexif.ExifIFD.ISOSpeedRatings]).toBe(800);
    expect(exif.Exif?.[piexif.ExifIFD.DateTimeOriginal]).toBe("2026:01:02 12:30:00");
    expect(exif.Exif?.[piexif.ExifIFD.ExposureTime]).toEqual([1, 250]);
    const fNumber = exif.Exif?.[piexif.ExifIFD.FNumber] as [number, number];
    expect(fNumber[0] / fNumber[1]).toBeCloseTo(2.8);
    expect(exif.GPS?.[piexif.GPSIFD.GPSLatitudeRef]).toBe("N");
    expect(exif.GPS?.[piexif.GPSIFD.GPSLongitudeRef]).toBe("W");
    expect(piexif.GPSHelper.dmsRationalToDeg(exif.GPS?.[piexif.GPSIFD.GPSLatitude], "N"))
      .toBeCloseTo(47.6, 4);
    expect(piexif.GPSHelper.dmsRationalToDeg(exif.GPS?.[piexif.GPSIFD.GPSLongitude], "W"))
      .toBeCloseTo(-122.3, 4);
  });
});
