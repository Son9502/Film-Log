import type { ChemicalSet, DevBatch, Roll } from "@/types";
import { formatDuration } from "./devCalc";

const DAY_MS = 86_400_000;

export interface SetStatus {
  expired: boolean;
  full: boolean;
  daysLeft?: number;
  rollsLeft?: number;
}

/** Shelf-life and capacity state of a chemical set; `today` is YYYY-MM-DD. */
export function chemSetStatus(set: ChemicalSet, today: string): SetStatus {
  let daysLeft: number | undefined;
  if (set.shelfLifeDays != null) {
    const age = Math.floor((Date.parse(today) - Date.parse(set.mixedAt)) / DAY_MS);
    daysLeft = set.shelfLifeDays - age;
  }
  const rollsLeft = set.capacityRolls != null ? set.capacityRolls - set.rollsUsed : undefined;
  return {
    expired: daysLeft != null && daysLeft < 0,
    full: rollsLeft != null && rollsLeft <= 0,
    daysLeft,
    rollsLeft,
  };
}

export function chemSetWarning(set: ChemicalSet, today: string): string | null {
  const st = chemSetStatus(set, today);
  if (st.expired && st.full) return "Past shelf life and at capacity";
  if (st.expired) return "Past shelf life";
  if (st.full) return "At capacity";
  return null;
}

export function parseDuration(text: string): number | null {
  const m = text.trim().match(/^(\d+)(?::([0-5]?\d))?$/);
  if (!m) return null;
  return m[2] === undefined ? parseInt(m[1], 10) * 60 : parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

/** "+1", "-1" or undefined at box speed. */
export function formatStops(stops: number | undefined): string | undefined {
  if (!stops) return undefined;
  return stops > 0 ? `+${stops}` : `${stops}`;
}

/**
 * The development fields a batch writes to each of its rolls, and the status they move to.
 * `stopsByRoll` carries each roll's push/pull from the batch plan, since rolls in one tank
 * can be shot at different speeds and still share a time.
 */
export function applyBatchToRolls(
  rolls: Roll[],
  batch: DevBatch,
  set: ChemicalSet,
  now: string,
  stopsByRoll: Record<string, number> = {},
): Roll[] {
  const ids = new Set(batch.rollIds);
  return rolls.map((r) =>
    ids.has(r.id)
      ? {
          ...r,
          status: "In Scanning",
          developedAt: batch.developedAt,
          developer: set.chemistryName,
          dilution: set.dilution ?? r.dilution,
          devTime: formatDuration(batch.timeSeconds),
          devTemp: `${batch.tempC}°C`,
          pushPull: r.id in stopsByRoll ? formatStops(stopsByRoll[r.id]) : r.pushPull,
          fixer: batch.fixer ?? r.fixer,
          photoFlo: batch.wettingAgent ?? r.photoFlo,
          updatedAt: now,
        }
      : r
  );
}

/** The batch a roll was developed in, if any (newest wins if a roll was somehow in two). */
export function batchForRoll(batches: DevBatch[], rollId: string): DevBatch | undefined {
  return batches
    .filter((b) => b.rollIds.includes(rollId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

/** Ids of every roll a chemical set has developed, newest batch first, without duplicates. */
export function rollIdsForSet(batches: DevBatch[], setId: string): string[] {
  const ids = batches
    .filter((b) => b.chemicalSetId === setId)
    .sort((a, b) => b.developedAt.localeCompare(a.developedAt) || b.createdAt.localeCompare(a.createdAt))
    .flatMap((b) => b.rollIds);
  return Array.from(new Set(ids));
}

/**
 * For rolls developed in a batch that are missing development details (e.g. batches
 * finished before the batch wrote them), fills only the empty fields from the batch.
 * Never overwrites what's there. Returns the same array if nothing changed.
 */
export function fillMissingFromBatches(rolls: Roll[], batches: DevBatch[], sets: ChemicalSet[], now: string): Roll[] {
  let changed = false;
  const out = rolls.map((r) => {
    const batch = batchForRoll(batches, r.id);
    if (!batch) return r;
    const set = sets.find((c) => c.id === batch.chemicalSetId);
    const fill: Partial<Roll> = {};
    if (!r.developedAt) fill.developedAt = batch.developedAt;
    if (!r.developer && set) fill.developer = set.chemistryName;
    if (!r.dilution && set?.dilution) fill.dilution = set.dilution;
    if (!r.devTime && batch.timeSeconds > 0) fill.devTime = formatDuration(batch.timeSeconds);
    if (!r.devTemp && Number.isFinite(batch.tempC)) fill.devTemp = `${batch.tempC}°C`;
    if (!r.fixer && batch.fixer) fill.fixer = batch.fixer;
    if (r.photoFlo == null && batch.wettingAgent != null) fill.photoFlo = batch.wettingAgent;
    if (Object.keys(fill).length === 0) return r;
    changed = true;
    return { ...r, ...fill, updatedAt: now };
  });
  return changed ? out : rolls;
}
