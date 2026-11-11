export interface DevRecipe {
  id: string;
  filmStockId: string; // "*" = any film
  developerId: string;
  dilution: string;
  exposureIso: number; // box ISO the time is for; 0 = not ISO-specific
  tempC: number | null;
  timeSeconds: number;
  agitation: string;
  push: boolean; // pushing allowed
  pull: boolean; // pulling allowed
  source?: string;
}

export interface TempPoint { tempC: number; timeFactor: number }

export interface PushCurve {
  mode: "multiply" | "add";
  /** multiply: time factor; add: seconds added. Must include stops = 0. */
  points: { stops: number; value: number }[];
}

export interface ProcessStep {
  order: number;
  name: string;
  tempC?: number | null;
  timeSeconds: number;
  instructions: string;
  isDevelop?: boolean;
  onlyIfRemjet?: boolean;
}

export interface KitDef {
  id: string;
  process: "C-41" | "E-6" | "ECN-2";
  name: string;
  exhaustionPctPerRoll: number;
  steps: ProcessStep[];
}

export interface ColorFilm {
  id: string;
  name: string;
  process: "C-41" | "E-6" | "ECN-2";
  boxIso: number;
  hasRemjet: boolean;
}

export interface CalcResult {
  timeSeconds: number;
  baseSeconds: number;
  baseTempC: number | null;
  stops: number;
  agitation: string;
  notes: string[];
}

export const stopsFromBox = (boxIso: number, shotIso: number) =>
  Math.round(Math.log2(shotIso / boxIso) * 100) / 100;

/** Linear interpolation of the time factor for a temperature; clamps outside the chart. */
export function tempFactor(chart: TempPoint[], tempC: number): number {
  if (chart.length === 0) return 1;
  const pts = [...chart].sort((a, b) => a.tempC - b.tempC);
  if (tempC <= pts[0].tempC) return pts[0].timeFactor;
  if (tempC >= pts[pts.length - 1].tempC) return pts[pts.length - 1].timeFactor;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    if (tempC >= a.tempC && tempC <= b.tempC) {
      const t = (tempC - a.tempC) / (b.tempC - a.tempC);
      return a.timeFactor + t * (b.timeFactor - a.timeFactor);
    }
  }
  return 1;
}

/** Interpolates the curve at a number of stops, extrapolating with the end slope. */
export function curveValue(curve: PushCurve, stops: number): number {
  const pts = [...curve.points].sort((a, b) => a.stops - b.stops);
  if (pts.length === 1) return pts[0].value;
  const slope = (a: { stops: number; value: number }, b: { stops: number; value: number }) =>
    (b.value - a.value) / (b.stops - a.stops);
  if (stops <= pts[0].stops) return pts[0].value + (stops - pts[0].stops) * slope(pts[0], pts[1]);
  const last = pts[pts.length - 1], prev = pts[pts.length - 2];
  if (stops >= last.stops) return last.value + (stops - last.stops) * slope(prev, last);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    if (stops >= a.stops && stops <= b.stops) return a.value + (stops - a.stops) * slope(a, b);
  }
  return pts[0].value;
}

export function applyPush(baseSeconds: number, stops: number, curve: PushCurve): number {
  const v = curveValue(curve, stops);
  const out = curve.mode === "multiply" ? baseSeconds * v : baseSeconds + v;
  return Math.max(baseSeconds * 0.2, out);
}

export interface CalcInput {
  recipes: DevRecipe[];
  filmStockId: string;
  developerId: string;
  dilution: string;
  shotIso: number;
  tempC: number;
  pushCurve: PushCurve;
  tempChart?: TempPoint[];
}

export function calculateDevTime(input: CalcInput): CalcResult | null {
  const matching = input.recipes.filter(
    (r) =>
      (r.filmStockId === input.filmStockId || r.filmStockId === "*") &&
      r.developerId === input.developerId &&
      r.dilution === input.dilution
  );
  if (matching.length === 0) return null;
  const recipe = matching.find((r) => r.filmStockId === input.filmStockId) ?? matching[0];

  const notes: string[] = [];
  let stops = 0;
  let seconds = recipe.timeSeconds;

  if (recipe.exposureIso > 0 && input.shotIso > 0) {
    stops = stopsFromBox(recipe.exposureIso, input.shotIso);
    if (stops > 0 && !recipe.push) {
      notes.push("Pushing isn't advised with this developer; time not extended.");
    } else if (stops < 0 && !recipe.pull) {
      notes.push("Pulling isn't covered for this developer; time not shortened.");
    } else if (stops !== 0) {
      seconds = applyPush(seconds, stops, input.pushCurve);
    }
  } else if (!recipe.push && !recipe.pull) {
    notes.push("Time isn't ISO-specific for this developer.");
  }

  if (input.tempChart && input.tempChart.length > 0 && recipe.tempC != null) {
    seconds *= tempFactor(input.tempChart, input.tempC) / tempFactor(input.tempChart, recipe.tempC);
  }

  return {
    timeSeconds: Math.round(seconds),
    baseSeconds: recipe.timeSeconds,
    baseTempC: recipe.tempC,
    stops,
    agitation: recipe.agitation,
    notes,
  };
}

export interface KitInput {
  kit: KitDef;
  shotIso: number;
  boxIso: number;
  pushCurve: PushCurve;
  rollsDeveloped: number;
}

export interface KitResult {
  developSeconds: number;
  baseSeconds: number;
  stops: number;
  notes: string[];
}

/** Color kits run at a fixed temperature, so only push/pull and reuse change the developer time. */
export function calculateKitTime(input: KitInput): KitResult | null {
  const dev = input.kit.steps.find((s) => s.isDevelop);
  if (!dev) return null;
  const notes: string[] = [];
  const stops = input.boxIso > 0 && input.shotIso > 0 ? stopsFromBox(input.boxIso, input.shotIso) : 0;
  let seconds = stops !== 0 ? applyPush(dev.timeSeconds, stops, input.pushCurve) : dev.timeSeconds;
  if (input.rollsDeveloped > 0 && input.kit.exhaustionPctPerRoll > 0) {
    seconds *= 1 + input.rollsDeveloped * input.kit.exhaustionPctPerRoll;
    notes.push(`+${Math.round(input.kit.exhaustionPctPerRoll * 100)}% per roll already processed (${input.rollsDeveloped}). Follow your kit's reuse chart.`);
  }
  return { developSeconds: Math.round(seconds), baseSeconds: dev.timeSeconds, stops, notes };
}

/** Steps with the develop time replaced and remjet-only steps filtered. */
export function buildSteps(steps: ProcessStep[], hasRemjet: boolean, devSeconds: number, devTempC?: number | null): ProcessStep[] {
  return [...steps]
    .sort((a, b) => a.order - b.order)
    .filter((s) => !s.onlyIfRemjet || hasRemjet)
    .map((s) => (s.isDevelop ? { ...s, timeSeconds: devSeconds, tempC: devTempC ?? s.tempC } : s));
}

export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

const THIRDS = ["", "⅓", "⅔"];

/** Stops rounded to the nearest third, e.g. 1.32 → "1⅓". */
export function formatThirds(stops: number): string {
  const thirds = Math.round(Math.abs(stops) * 3);
  const whole = Math.floor(thirds / 3);
  const frac = THIRDS[thirds % 3];
  return `${whole > 0 || !frac ? whole : ""}${frac}`;
}

/** "Box speed", or "+2 stops: push in development" for a roll rated away from box speed. */
export function pushLabel(boxIso: number, shotIso: number): string {
  const stops = stopsFromBox(boxIso, shotIso);
  if (Math.round(Math.abs(stops) * 3) === 0) return "Box speed: develop normally.";
  const n = formatThirds(stops);
  const unit = Math.round(Math.abs(stops) * 3) <= 3 ? "stop" : "stops";
  return stops > 0
    ? `+${n} ${unit}: push this roll in development.`
    : `−${n} ${unit}: pull this roll in development.`;
}
