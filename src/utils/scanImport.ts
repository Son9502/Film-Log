export type ScanAssignments = Record<string, number | null>;

export function identifyScanFiles<T extends object>(files: T[]): (T & { id: string })[] {
  return files.map((file, index) => ({ ...file, id: String(index) }));
}

export function assignScanFrames(files: { id: string }[], frameNumbers: number[]): ScanAssignments {
  return Object.fromEntries(files.map((file, index) => [file.id, frameNumbers[index] ?? null]));
}

export function planMissingScanFrames(
  fileIds: string[],
  frameNumbers: number[],
  assignments: ScanAssignments,
): { frames: number[]; assignments: ScanAssignments } {
  const missing = Math.max(0, fileIds.length - frameNumbers.length);
  const first = Math.max(0, ...frameNumbers) + 1;
  const frames = Array.from({ length: missing }, (_, index) => first + index);
  const updated = { ...assignments };
  let next = 0;
  for (const fileId of fileIds) {
    if (updated[fileId] == null && next < frames.length) updated[fileId] = frames[next++];
  }
  return { frames, assignments: updated };
}
