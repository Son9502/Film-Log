import { BW_STOCKS, COLOR_FILMS } from "@/constants/devData";
import type { DevProcess, FilmStock } from "@/types";

export interface FilmMatch {
  process: DevProcess;
  /** id in BW_STOCKS or COLOR_FILMS */
  calcId: string;
  name: string;
  boxIso: number;
  hasRemjet: boolean;
}

const BRANDS = /\b(kodak|fujifilm|fuji|ilford)\b/g;
const norm = (s: string) => s.toLowerCase().replace(BRANDS, "").replace(/\s+/g, " ").trim();

/** Expands a family name such as "Kodak Portra 160 / 400 / 800" into its individual films. */
function familyMembers(name: string): string[] {
  const parts = name.split("/").map((p) => p.trim());
  const out: string[] = [];
  let prefix = "";
  for (const p of parts) {
    if (/^\d+[a-z]?$/i.test(p)) out.push(`${prefix} ${p}`.trim());
    else {
      out.push(p);
      prefix = p.replace(/\s*\d+[a-z]?$/i, "").trim();
    }
  }
  return out.map(norm);
}

const FUJI_NEGATIVE = /(superia|pro 400h|c200|xtra)/;

/** Maps one of the app's film stocks onto the calculator's reference data, or null if there is no data for it. */
export function matchFilm(stock: Pick<FilmStock, "name" | "iso">): FilmMatch | null {
  const n = norm(stock.name);

  const bw = BW_STOCKS.find((b) => norm(b.name) === n);
  if (bw) return { process: "B&W", calcId: bw.id, name: bw.name, boxIso: bw.boxIso, hasRemjet: false };

  for (const f of COLOR_FILMS) {
    if (familyMembers(f.name).includes(n)) {
      return { process: f.process, calcId: f.id, name: f.name, boxIso: stock.iso || f.boxIso, hasRemjet: f.hasRemjet };
    }
  }

  if (/fuji/i.test(stock.name) && FUJI_NEGATIVE.test(n)) {
    const f = COLOR_FILMS.find((x) => x.name === "Fujifilm 200 / 400");
    if (f) return { process: f.process, calcId: f.id, name: f.name, boxIso: stock.iso || f.boxIso, hasRemjet: f.hasRemjet };
  }
  return null;
}

export const DEV_PROCESSES: DevProcess[] = ["B&W", "C-41", "E-6", "ECN-2"];

/** The process a stock is developed in: what the user set, else what the reference data says, else null. */
export function stockProcess(stock: Pick<FilmStock, "name" | "iso" | "process"> | undefined): DevProcess | null {
  if (!stock) return null;
  return stock.process ?? matchFilm(stock)?.process ?? null;
}
