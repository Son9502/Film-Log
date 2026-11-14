/** Working solution per 35mm reel in a typical small tank (e.g. Paterson: ~290 ml). 120 needs ~500 ml. */
export const DEFAULT_ML_PER_ROLL = 300;

export interface Ratio {
  stock: number;
  water: number;
}

/**
 * Reads a dilution such as "1+1", "1:50", "Dil. B (1+31)" or "Stock".
 * Returns { stock: 1, water: 0 } for undiluted ("Stock") and null when it can't tell.
 */
export function parseDilution(text: string | undefined): Ratio | null {
  if (!text) return null;
  const t = text.trim();
  if (/^stock$/i.test(t) || /^undiluted$/i.test(t)) return { stock: 1, water: 0 };
  const m = t.match(/(\d+(?:\.\d+)?)\s*[+:]\s*(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const stock = parseFloat(m[1]);
  const water = parseFloat(m[2]);
  if (!(stock > 0) || water < 0) return null;
  return { stock, water };
}

export interface Mix {
  concentrateMl: number;
  waterMl: number;
}

/** How much concentrate and water make `totalMl` of working solution at `dilution`. */
export function mixFor(totalMl: number, dilution: string | undefined): Mix | null {
  const ratio = parseDilution(dilution);
  if (!ratio || !(totalMl > 0)) return null;
  const concentrate = (totalMl * ratio.stock) / (ratio.stock + ratio.water);
  // Whole ml is plenty for most dilutions; keep one decimal for very dilute ones (e.g. 1+100).
  const round = (n: number) => (n < 20 ? Math.round(n * 10) / 10 : Math.round(n));
  const concentrateMl = round(concentrate);
  return { concentrateMl, waterMl: Math.max(0, Math.round(totalMl - concentrateMl)) };
}

/** A warning when the concentrate in the tank is below the datasheet minimum for that many rolls. */
export function minimumWarning(mix: Mix | null, rolls: number, minPerRoll: number | undefined): string | null {
  if (!mix || !minPerRoll || rolls <= 0) return null;
  const needed = minPerRoll * rolls;
  if (mix.concentrateMl + 1e-9 >= needed) return null;
  return `Only ${mix.concentrateMl} ml of concentrate for ${rolls} roll${rolls === 1 ? "" : "s"}; ` +
    `this set needs at least ${needed} ml. Use more solution or a stronger dilution.`;
}
