import { Roll } from "@/types";

export interface RollFilters {
  query?: string;
  status?: string;
  cameraId?: string;
  filmStockId?: string;
  location?: string;
  from?: string; // YYYY-MM-DD, matches loadedAt
  to?: string;
}

export function filterRolls(
  rolls: Roll[],
  f: RollFilters,
  names: { film: (id: string) => string; camera: (id: string) => string }
): Roll[] {
  const q = f.query?.trim().toLowerCase();
  const loc = f.location?.trim().toLowerCase();
  return rolls.filter((r) => {
    if (f.status && r.status !== f.status) return false;
    if (f.cameraId && r.cameraId !== f.cameraId) return false;
    if (f.filmStockId && r.filmStockId !== f.filmStockId) return false;
    const day = r.loadedAt.slice(0, 10);
    if (f.from && day < f.from) return false;
    if (f.to && day > f.to) return false;
    if (loc) {
      const labels = [r.locationLabel, ...r.shots.map((s) => s.locationLabel)];
      if (!labels.some((l) => l?.toLowerCase().includes(loc))) return false;
    }
    if (q) {
      const hay = [r.name, names.film(r.filmStockId), names.camera(r.cameraId), r.notes, r.locationLabel]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
