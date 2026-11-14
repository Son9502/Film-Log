import { filmStripScanLayout, fitScanPreview } from "./scanLayout";

describe("filmStripScanLayout", () => {
  it("rotates portrait scans clockwise and fits them in a landscape frame", () => {
    expect(filmStripScanLayout(2000, 3000, 120, 80)).toEqual({
      rotation: 90, frameWidth: 120, frameHeight: 80,
      imageWidth: 80, imageHeight: 120, left: 20, top: -20,
    });
  });

  it("keeps landscape and square scans upright and uncropped", () => {
    expect(filmStripScanLayout(3000, 2000, 120, 80)).toEqual({
      rotation: 0, frameWidth: 120, frameHeight: 80,
      imageWidth: 120, imageHeight: 80, left: 0, top: 0,
    });
    expect(filmStripScanLayout(1000, 1000, 120, 80)).toEqual({
      rotation: 0, frameWidth: 80, frameHeight: 80,
      imageWidth: 80, imageHeight: 80, left: 0, top: 0,
    });
  });

  it("fits non-3:2 portrait scans without distortion or cropping", () => {
    expect(filmStripScanLayout(1000, 2000, 120, 80)).toEqual({
      rotation: 90, frameWidth: 120, frameHeight: 60,
      imageWidth: 60, imageHeight: 120, left: 30, top: -30,
    });
  });
});

describe("fitScanPreview", () => {
  it("fits portrait and landscape scans without cropping", () => {
    expect(fitScanPreview(2000, 3000, 0, 300, 240)).toEqual({
      frameWidth: 160, frameHeight: 240, imageWidth: 160, imageHeight: 240, left: 0, top: 0,
    });
    expect(fitScanPreview(3000, 2000, 0, 300, 240)).toEqual({
      frameWidth: 300, frameHeight: 200, imageWidth: 300, imageHeight: 200, left: 0, top: 0,
    });
  });

  it("centers rotated scans within the available space", () => {
    expect(fitScanPreview(2000, 3000, 90, 300, 240)).toEqual({
      frameWidth: 300, frameHeight: 200, imageWidth: 200, imageHeight: 300, left: 50, top: -50,
    });
    expect(fitScanPreview(3000, 2000, 270, 300, 240)).toEqual({
      frameWidth: 160, frameHeight: 240, imageWidth: 240, imageHeight: 160, left: -40, top: 40,
    });
  });

  it("fits square images without stretching", () => {
    expect(fitScanPreview(1000, 1000, 180, 300, 240)).toEqual({
      frameWidth: 240, frameHeight: 240, imageWidth: 240, imageHeight: 240, left: 0, top: 0,
    });
  });
});
