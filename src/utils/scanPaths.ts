import type { Roll, Shot } from "@/types";

function safeName(value: string): string {
  return value.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "_") || "roll";
}

function extension(path: string): string {
  return path.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
}

/** Where a frame's scan sits in the scan ZIP export, e.g. "Yosemite-r1/frame-007.jpg". */
export function scanArchivePath(roll: Pick<Roll, "id" | "name">, shot: Pick<Shot, "frame" | "scanUri">): string | undefined {
  if (!shot.scanUri) return undefined;
  const folder = `${safeName(roll.name || roll.id)}-${safeName(roll.id)}`;
  return `${folder}/frame-${String(shot.frame).padStart(3, "0")}.${extension(shot.scanUri) || "jpg"}`;
}

export { extension as scanExtension };
