import type { PushCurve, TempPoint, ProcessStep } from "@/utils/devCalc";

export * from "./devData.generated";

// Assumptions from the workbook's Read Me sheet; adjust to your own results.
// B&W push factors follow the Digitaltruth general push-processing guidelines (used when no published push time exists).
// Pull (−1 stop = ×0.75) comes from the workbook.
export const PUSH_CURVES: Record<"bwStandard" | "bwCompensating" | "bwTmax" | "c41" | "ecn2" | "e6", PushCurve> = {
  bwStandard: { mode: "multiply", points: [{ stops: -1, value: 0.75 }, { stops: 0, value: 1 }, { stops: 1, value: 1.5 }, { stops: 2, value: 2.25 }, { stops: 3, value: 4.5 }] },
  bwCompensating: { mode: "multiply", points: [{ stops: -1, value: 0.75 }, { stops: 0, value: 1 }, { stops: 1, value: 1.4 }, { stops: 2, value: 1.85 }, { stops: 3, value: 2.5 }] },
  bwTmax: { mode: "multiply", points: [{ stops: -1, value: 0.75 }, { stops: 0, value: 1 }, { stops: 1, value: 1 }, { stops: 2, value: 1.33 }, { stops: 3, value: 1.66 }] },
  c41: { mode: "multiply", points: [{ stops: -1, value: 0.8 }, { stops: 0, value: 1 }, { stops: 1, value: 1.3 }, { stops: 2, value: 1.7 }] },
  ecn2: { mode: "multiply", points: [{ stops: -1, value: 0.8 }, { stops: 0, value: 1 }, { stops: 1, value: 1.3 }, { stops: 2, value: 1.7 }] },
  // E-6 adds seconds to the first developer only
  e6: { mode: "add", points: [{ stops: -1, value: -120 }, { stops: 0, value: 0 }, { stops: 1, value: 120 }, { stops: 2, value: 300 }] },
};

const COMPENSATING_DEVELOPERS = ["ilford-dd-x", "kodak-t-max-developer"];
const TMAX_FILMS = ["kodak-t-max-100", "kodak-t-max-400", "kodak-t-max-p3200"];

export function bwPushCurve(developerId: string, filmStockId: string): { curve: PushCurve; label: string } {
  if (TMAX_FILMS.includes(filmStockId)) return { curve: PUSH_CURVES.bwTmax, label: "T-Max film push factors" };
  if (COMPENSATING_DEVELOPERS.includes(developerId)) return { curve: PUSH_CURVES.bwCompensating, label: "compensating developer push factors" };
  return { curve: PUSH_CURVES.bwStandard, label: "standard developer push factors" };
}

// Approximates the Ilford/Kodak time-temperature charts
export const BW_TEMP_CHART: TempPoint[] = [
  { tempC: 18, timeFactor: 1.2 },
  { tempC: 19, timeFactor: 1.09 },
  { tempC: 20, timeFactor: 1 },
  { tempC: 21, timeFactor: 0.91 },
  { tempC: 22, timeFactor: 0.84 },
  { tempC: 23, timeFactor: 0.76 },
  { tempC: 24, timeFactor: 0.7 },
  { tempC: 25, timeFactor: 0.64 },
  { tempC: 26, timeFactor: 0.58 },
];

export const BW_STEPS: ProcessStep[] = [
  { order: 1, name: "Developer", timeSeconds: 0, instructions: "Agitate per recipe", isDevelop: true },
  { order: 2, name: "Stop bath (or water)", tempC: 20, timeSeconds: 60, instructions: "30–60 s, or 3 water changes" },
  { order: 3, name: "Fixer", tempC: 20, timeSeconds: 300, instructions: "3–5 min; lean toward 5 for T-Max/Delta" },
  { order: 4, name: "Wash", tempC: 20, timeSeconds: 300, instructions: "Ilford method: fill/invert 5×, 10×, 20×" },
  { order: 5, name: "Wetting agent", timeSeconds: 60, instructions: "30–60 s, then hang to dry" },
];
