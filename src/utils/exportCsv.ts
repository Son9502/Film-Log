import { Roll } from "@/types";

function cell(v: unknown): string {
  const s = v === undefined || v === null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const toCsv = (header: string[], rows: unknown[][]) =>
  [header, ...rows].map((r) => r.map(cell).join(",")).join("\n");

type Names = { film: (id: string) => string; camera: (id: string) => string };

export function rollsToCsv(rolls: Roll[], names: Names): string {
  return toCsv(
    [
      "roll_id", "name", "film", "camera", "iso", "frame_count", "frames_logged", "status",
      "loaded_at", "developed_at", "location", "developer", "dilution", "dev_time", "dev_temp",
      "push_pull", "fixer", "film_expires", "expiry_comp_stops", "notes",
    ],
    rolls.map((r) => [
      r.id, r.name, names.film(r.filmStockId), names.camera(r.cameraId), r.iso, r.frameCount,
      r.shots.length, r.status, r.loadedAt, r.developedAt, r.locationLabel, r.developer, r.dilution,
      r.devTime, r.devTemp, r.pushPull, r.fixer, r.expiresAt, r.expiryCompStops, r.notes,
    ])
  );
}

export function framesToCsv(rolls: Roll[], names: Names): string {
  return toCsv(
    [
      "roll_id", "roll_name", "film", "camera", "frame", "shot_at", "shutter", "aperture", "lighting",
      "subject", "location", "latitude", "longitude", "flash", "filter", "weather", "rating", "tags", "notes",
    ],
    rolls.flatMap((r) =>
      r.shots.map((s) => [
        r.id, r.name, names.film(r.filmStockId), names.camera(r.cameraId), s.frame, s.timestamp,
        s.shutter, s.aperture, s.lighting, s.subject, s.locationLabel ?? r.locationLabel,
        s.location?.latitude, s.location?.longitude, s.flash ? "yes" : "", s.filter, s.weather,
        s.rating, s.tags?.join("; "), s.notes,
      ])
    )
  );
}
