export function filmStripScanLayout(width: number, height: number, maxWidth: number, maxHeight: number) {
  const rotation = height > width ? 90 : 0;
  return { rotation, ...fitScanPreview(width, height, rotation, maxWidth, maxHeight) };
}

export function fitScanPreview(
  width: number,
  height: number,
  rotation: 0 | 90 | 180 | 270,
  maxWidth: number,
  maxHeight: number,
) {
  const sideways = rotation === 90 || rotation === 270;
  const displayWidth = sideways ? height : width;
  const displayHeight = sideways ? width : height;
  const scale = Math.min(maxWidth / displayWidth, maxHeight / displayHeight);
  const imageWidth = width * scale;
  const imageHeight = height * scale;
  const frameWidth = displayWidth * scale;
  const frameHeight = displayHeight * scale;
  return {
    frameWidth,
    frameHeight,
    imageWidth,
    imageHeight,
    left: (frameWidth - imageWidth) / 2,
    top: (frameHeight - imageHeight) / 2,
  };
}
