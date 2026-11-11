import { BW_RECIPES, BW_TEMP_CHART, COLOR_KITS, PUSH_CURVES, bwPushCurve } from "@/constants/devData";
import type { ChemicalSet, DevProcess, FilmStock, Roll } from "@/types";
import { calculateDevTime, calculateKitTime, formatDuration } from "./devCalc";
import { chemSetStatus } from "./chemistry";
import { FilmMatch, matchFilm, stockProcess } from "./filmMatch";

export interface RollPlan {
  rollId: string;
  label: string;
  match: FilmMatch | null;
  /** The film's process (set on the stock, or from the reference data). */
  process: DevProcess | null;
  shotIso: number;
  stops: number;
  seconds: number | null;
  tempC: number | null;
  notes: string[];
}

export interface BatchPlan {
  rolls: RollPlan[];
  /** Agreed time and temperature when every roll can be developed together. */
  seconds: number | null;
  tempC: number | null;
  blockers: string[];
  warnings: string[];
  /** Rolls need noticeably different times; no shared time is suggested. */
  timeMismatch?: boolean;
}

/** Rolls whose times differ by more than this fraction can't share a tank. */
export const TIME_TOLERANCE = 0.05;

const CURVE_KEY = { "C-41": "c41", "E-6": "e6", "ECN-2": "ecn2" } as const;

function planRoll(
  roll: Roll,
  stock: FilmStock | undefined,
  set: ChemicalSet,
  tempOverride: number | undefined
): RollPlan {
  const label = roll.name || stock?.name || "Unknown film";
  const shotIso = parseInt(roll.iso, 10) || stock?.iso || 0;
  const process = stockProcess(stock);
  // Reference data for a different process than the user set doesn't apply.
  const found = stock ? matchFilm(stock) : null;
  const match = found && found.process === process ? found : null;
  const base: RollPlan = { rollId: roll.id, label, match, process, shotIso, stops: 0, seconds: null, tempC: null, notes: [] };
  if (!match) return base;

  if (set.process === "B&W") {
    const dilution = set.dilution ?? "";
    const recipe = BW_RECIPES.find(
      (r) =>
        (r.filmStockId === match.calcId || r.filmStockId === "*") &&
        r.developerId === set.chemistryId &&
        r.dilution === dilution
    );
    if (!recipe) return base;
    const tempC = tempOverride ?? recipe.tempC ?? 20;
    const curve = bwPushCurve(set.chemistryId, match.calcId);
    const r = calculateDevTime({
      recipes: BW_RECIPES, filmStockId: match.calcId, developerId: set.chemistryId, dilution,
      shotIso, tempC, pushCurve: curve.curve, tempChart: BW_TEMP_CHART,
    });
    if (!r) return base;
    return { ...base, seconds: r.timeSeconds, tempC, stops: r.stops, notes: r.notes };
  }

  const kit = COLOR_KITS.find((k) => k.id === set.chemistryId);
  if (!kit) return base;
  const r = calculateKitTime({
    kit, shotIso, boxIso: match.boxIso, pushCurve: PUSH_CURVES[CURVE_KEY[set.process]], rollsDeveloped: set.rollsUsed,
  });
  if (!r) return base;
  const dev = kit.steps.find((s) => s.isDevelop);
  return { ...base, seconds: r.developSeconds, tempC: dev?.tempC ?? null, stops: r.stops, notes: r.notes };
}

export function planBatch(input: {
  rolls: Roll[];
  stocks: FilmStock[];
  set: ChemicalSet | undefined;
  tempC?: number;
  today: string;
}): BatchPlan {
  const { rolls, stocks, set, today } = input;
  const plan: BatchPlan = { rolls: [], seconds: null, tempC: null, blockers: [], warnings: [] };
  if (!set || rolls.length === 0) return plan;

  plan.rolls = rolls.map((r) => planRoll(r, stocks.find((s) => s.id === r.filmStockId), set, input.tempC));

  const unknown = plan.rolls.filter((p) => !p.match);
  if (unknown.length > 0) {
    plan.warnings.push(
      `No reference data for ${unknown.map((p) => p.label).join(", ")}. Enter the time and set their push/pull yourself.`
    );
  }
  const matched = plan.rolls.filter((p) => p.match);

  const processes = new Set(plan.rolls.flatMap((p) => (p.process ? [p.process] : [])));
  if (processes.size > 1) {
    plan.blockers.push(`These rolls use different processes (${[...processes].join(", ")}). Develop each process separately.`);
  } else if (processes.size === 1 && !processes.has(set.process)) {
    plan.blockers.push(`These rolls are ${[...processes][0]} film but the chemical set is ${set.process}.`);
  }

  const remjet = matched.filter((p) => p.match!.hasRemjet);
  if (remjet.length > 0 && remjet.length < matched.length) {
    plan.blockers.push("Remjet film (Vision3 / ECN-2) must be developed on its own, apart from non-remjet film.");
  }

  if (plan.blockers.length === 0) {
    for (const p of matched) {
      if (p.seconds === null) {
        plan.blockers.push(`No ${set.chemistryName}${set.dilution ? ` ${set.dilution}` : ""} time for ${p.label}. Use a different set or develop it separately.`);
      }
    }
  }

  const timed = matched.filter((p) => p.seconds !== null);
  if (timed.length > 0 && plan.blockers.length === 0) {
    const secs = timed.map((p) => p.seconds!);
    const min = Math.min(...secs);
    const max = Math.max(...secs);
    if ((max - min) / max > TIME_TOLERANCE) {
      // Not a blocker: one tank means one time, so it's the user's call whether to split
      // the batch or accept that some rolls get more or less development than planned.
      const lines = timed.map((p) => `${p.label} ${formatDuration(p.seconds!)}${p.stops ? ` (${p.stops > 0 ? "+" : ""}${p.stops} stop)` : ""}`);
      const pushes = new Set(timed.map((p) => p.stops));
      plan.timeMismatch = true;
      plan.warnings.unshift(
        (pushes.size > 1
          ? `These rolls are pushed/pulled by different amounts: ${lines.join("; ")}.`
          : `These rolls need different times: ${lines.join("; ")}.`) +
        " Developing them together means one time for all of them. Split them into separate batches, or enter the time you'll use."
      );
    } else {
      plan.seconds = Math.round(secs.reduce((a, b) => a + b, 0) / secs.length);
      plan.tempC = timed[0].tempC;
    }
  }

  for (const p of matched) for (const n of p.notes) plan.warnings.push(`${p.label}: ${n}`);

  const st = chemSetStatus(set, today);
  if (st.expired) plan.warnings.push("This chemical set is past its shelf life.");
  if (st.rollsLeft != null && rolls.length > Math.max(st.rollsLeft, 0)) {
    plan.warnings.push(`This set has ${Math.max(st.rollsLeft, 0)} roll${st.rollsLeft === 1 ? "" : "s"} of capacity left; you picked ${rolls.length}.`);
  }
  return plan;
}
