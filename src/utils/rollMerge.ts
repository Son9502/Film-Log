/**
 * Conflict-safe roll and frame sync: the pure part.
 *
 * Every roll and frame this device has synced keeps a "base": the server revision
 * and field values it last agreed with the cloud. That makes everything else
 * derivable from state, with no outbox to lose:
 *
 *   - local differs from base  → this device changed it  → push (guarded by revision)
 *   - remote differs from base → another device changed it → pull
 *   - both differ              → three-way merge per field; only the same field
 *                                changed to different values on both sides is a conflict
 *   - base but no local copy   → deleted here  → push a guarded delete
 *   - base but no remote copy  → deleted elsewhere → remove here (or ask, if edited here)
 *
 * The server (supabase/13–15) rejects any write whose expected revision is stale,
 * so two devices can never silently overwrite each other.
 */
import type { Roll, Shot } from "@/types";
import {
  SyncFields, rollSyncFields, shotSyncFields, rollFromSyncFields, shotFromSyncFields,
} from "./rollRows";

export interface EntityBase {
  revision: number;
  fields: SyncFields;
}

export interface ShotBase extends EntityBase {
  rollId: string;
}

export interface SyncMeta {
  rolls: Record<string, EntityBase>;
  shots: Record<string, ShotBase>;
}

export const emptyMeta = (): SyncMeta => ({ rolls: {}, shots: {} });

export interface RemoteRow {
  id: string;
  revision: number;
  fields: SyncFields;
}

export interface RemoteShotRow extends RemoteRow {
  rollId: string;
}

export interface RemoteSnapshot {
  rolls: RemoteRow[];
  shots: RemoteShotRow[];
  /** Keys "roll:<id>" and "frame:<id>" for rows deleted on the server. */
  tombstones: Set<string>;
}

export interface FieldConflict {
  name: string;
  local: unknown;
  remote: unknown;
}

export interface SyncConflict {
  kind: "roll" | "frame";
  id: string;
  rollId: string;
  /**
   * edited-both: the same field changed differently here and elsewhere.
   * first-sync:  this device and the cloud both had the record before sync existed, with different values.
   * deleted-elsewhere: deleted on another device but changed here.
   */
  reason: "edited-both" | "first-sync" | "deleted-elsewhere";
  fields: FieldConflict[];
  remote?: RemoteRow;
}

export type SyncOp =
  | { type: "write-roll"; id: string; expected: number | null; fields: SyncFields }
  | { type: "write-shot"; id: string; rollId: string; expected: number | null; fields: SyncFields }
  | { type: "delete-shot"; id: string; rollId: string; expected: number; scanUri: string | null }
  | { type: "delete-roll"; id: string; expected: number };

// Fields that never conflict: the newest timestamp wins.
const LATEST_WINS = new Set(["updated_at"]);
// Fields where the earliest value wins.
const EARLIEST_WINS = new Set(["created_at"]);

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const isEmpty = (v: unknown) => v === null || v === undefined || v === "";

export function fieldsEqual(a: SyncFields, b: SyncFields): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) if (!same(a[k], b[k])) return false;
  return true;
}

function pickTimestamp(name: string, a: unknown, b: unknown): unknown {
  if (isEmpty(a)) return b;
  if (isEmpty(b)) return a;
  const later = String(a) > String(b) ? a : b;
  const earlier = later === a ? b : a;
  return LATEST_WINS.has(name) ? later : earlier;
}

/** Three-way merge. With no base (first sync), an empty value on one side never conflicts. */
export function mergeFields(
  local: SyncFields, remote: SyncFields, base: SyncFields | undefined,
): { merged: SyncFields; conflicts: FieldConflict[] } {
  const merged: SyncFields = {};
  const conflicts: FieldConflict[] = [];
  const keys = new Set([...Object.keys(local), ...Object.keys(remote)]);
  for (const k of keys) {
    const l = local[k] ?? null;
    const r = remote[k] ?? null;
    if (same(l, r)) { merged[k] = l; continue; }
    if (LATEST_WINS.has(k) || EARLIEST_WINS.has(k)) { merged[k] = pickTimestamp(k, l, r) as SyncFields[string]; continue; }
    if (base) {
      const b = base[k] ?? null;
      if (same(l, b)) { merged[k] = r; continue; }   // only the cloud changed it
      if (same(r, b)) { merged[k] = l; continue; }   // only this device changed it
    } else {
      if (isEmpty(l)) { merged[k] = r; continue; }
      if (isEmpty(r)) { merged[k] = l; continue; }
    }
    merged[k] = l; // keep this device's value until the conflict is resolved
    conflicts.push({ name: k, local: l, remote: r });
  }
  return { merged, conflicts };
}

export interface ReconcileResult {
  rolls: Roll[];
  meta: SyncMeta;
  conflicts: SyncConflict[];
  /** Plain-language notes about changes the user might not expect, e.g. a restored roll. */
  notices: string[];
}

const rollLabel = (fields: SyncFields | undefined, fallback = "A roll") =>
  typeof fields?.name === "string" && fields.name ? `"${fields.name}"` : fallback;

/**
 * Pull step: folds the cloud snapshot into local rolls and advances bases for
 * everything that merged cleanly. Synchronous so it can be applied atomically.
 */
export function reconcile(local: Roll[], meta: SyncMeta, remote: RemoteSnapshot): ReconcileResult {
  const nextMeta: SyncMeta = { rolls: { ...meta.rolls }, shots: { ...meta.shots } };
  const conflicts: SyncConflict[] = [];
  const notices: string[] = [];

  const remoteRolls = new Map(remote.rolls.map((r) => [r.id, r]));
  const remoteShotsByRoll = new Map<string, RemoteShotRow[]>();
  for (const s of remote.shots) {
    const list = remoteShotsByRoll.get(s.rollId) ?? [];
    list.push(s);
    remoteShotsByRoll.set(s.rollId, list);
  }
  const localIds = new Set(local.map((r) => r.id));
  const out: Roll[] = [];

  // 1. Rolls this device has.
  for (const roll of local) {
    const base = meta.rolls[roll.id];
    const rem = remoteRolls.get(roll.id);
    const localFields = rollSyncFields(roll);
    let rollOut: Roll = roll;

    if (!rem) {
      // Only a tombstone means "deleted". A synced roll missing without one (a manual
      // delete in the dashboard, a bad read) is kept and uploaded again, never dropped.
      const deletedElsewhere = remote.tombstones.has(`roll:${roll.id}`);
      if (!deletedElsewhere) {
        if (base) {
          delete nextMeta.rolls[roll.id];
          for (const s of roll.shots) delete nextMeta.shots[s.id];
        }
        out.push(mergeShots(roll, roll, base ? stripRoll(meta, roll) : meta, nextMeta, remoteShotsByRoll.get(roll.id) ?? [], remote.tombstones, conflicts, notices));
        continue; // new on this device (or lost from the cloud): pushed later
      }
      const editedHere = !base || !fieldsEqual(localFields, base.fields) ||
        roll.shots.some((s) => { const sb = meta.shots[s.id]; return !sb || !fieldsEqual(shotSyncFields(s), sb.fields); });
      if (!editedHere) {
        delete nextMeta.rolls[roll.id];
        for (const s of roll.shots) delete nextMeta.shots[s.id];
        notices.push(`${rollLabel(localFields)} was deleted on another device.`);
        continue;
      }
      conflicts.push({ kind: "roll", id: roll.id, rollId: roll.id, reason: "deleted-elsewhere", fields: [] });
      out.push(roll);
      continue;
    }

    if (base && base.revision === rem.revision) {
      // Cloud unchanged since last sync; anything different is a local edit.
    } else {
      const { merged, conflicts: fc } = mergeFields(localFields, rem.fields, base?.fields);
      if (fc.length > 0) {
        conflicts.push({ kind: "roll", id: roll.id, rollId: roll.id, reason: base ? "edited-both" : "first-sync", fields: fc, remote: rem });
      } else {
        nextMeta.rolls[roll.id] = { revision: rem.revision, fields: rem.fields };
        if (!fieldsEqual(merged, localFields)) rollOut = rollFromSyncFields(roll.id, merged, roll);
      }
    }
    out.push(mergeShots(roll, rollOut, meta, nextMeta, remoteShotsByRoll.get(roll.id) ?? [], remote.tombstones, conflicts, notices));
  }

  // 2. Rolls this device doesn't have: new in the cloud, or deleted here.
  for (const rem of remote.rolls) {
    if (localIds.has(rem.id)) continue;
    const base = meta.rolls[rem.id];
    const remShots = remoteShotsByRoll.get(rem.id) ?? [];
    const shots = remShots.map((s) => shotFromSyncFields(s.id, s.fields)).sort((a, b) => a.frame - b.frame);

    if (base) {
      // Deleted here. If the cloud copy (or any of its frames) moved on, restore it rather than lose that work.
      const changedElsewhere = base.revision !== rem.revision ||
        remShots.some((s) => meta.shots[s.id]?.revision !== s.revision);
      if (!changedElsewhere) continue; // the delete is pushed in the push step
      notices.push(`${rollLabel(rem.fields)} was changed on another device after you deleted it here, so it was restored.`);
    }
    out.push({ ...rollFromSyncFields(rem.id, rem.fields), shots });
    nextMeta.rolls[rem.id] = { revision: rem.revision, fields: rem.fields };
    for (const s of remShots) nextMeta.shots[s.id] = { revision: s.revision, fields: s.fields, rollId: s.rollId };
  }

  // 3. Forget bases for records gone everywhere.
  const outRollIds = new Set(out.map((r) => r.id));
  const outShotIds = new Set(out.flatMap((r) => r.shots.map((s) => s.id)));
  const remoteShotIds = new Set(remote.shots.map((s) => s.id));
  for (const id of Object.keys(nextMeta.rolls)) {
    if (!remoteRolls.has(id) && !outRollIds.has(id)) delete nextMeta.rolls[id];
  }
  for (const id of Object.keys(nextMeta.shots)) {
    if (!outShotIds.has(id) && !remoteShotIds.has(id)) delete nextMeta.shots[id];
  }

  return { rolls: out, meta: nextMeta, conflicts, notices };
}

function mergeShots(
  original: Roll,
  roll: Roll,
  meta: SyncMeta,
  nextMeta: SyncMeta,
  remoteShots: RemoteShotRow[],
  tombstones: Set<string>,
  conflicts: SyncConflict[],
  notices: string[],
): Roll {
  const remoteById = new Map(remoteShots.map((s) => [s.id, s]));
  const localIds = new Set(original.shots.map((s) => s.id));
  let changed = roll !== original;
  const shots: Shot[] = [];

  for (const shot of original.shots) {
    const base = meta.shots[shot.id];
    const rem = remoteById.get(shot.id);
    const localFields = shotSyncFields(shot);

    if (!rem) {
      const deletedElsewhere = tombstones.has(`frame:${shot.id}`);
      if (!deletedElsewhere) {
        if (base) { delete nextMeta.shots[shot.id]; changed = true; } // missing without a tombstone: upload again
        shots.push(shot);
        continue;
      }
      if (base && fieldsEqual(localFields, base.fields)) {
        delete nextMeta.shots[shot.id];
        changed = true;
        continue;
      }
      conflicts.push({ kind: "frame", id: shot.id, rollId: original.id, reason: "deleted-elsewhere", fields: [] });
      shots.push(shot);
      continue;
    }

    if (base && base.revision === rem.revision) { shots.push(shot); continue; }
    const { merged, conflicts: fc } = mergeFields(localFields, rem.fields, base?.fields);
    if (fc.length > 0) {
      conflicts.push({ kind: "frame", id: shot.id, rollId: original.id, reason: base ? "edited-both" : "first-sync", fields: fc, remote: rem });
      shots.push(shot);
      continue;
    }
    nextMeta.shots[shot.id] = { revision: rem.revision, fields: rem.fields, rollId: original.id };
    if (fieldsEqual(merged, localFields)) { shots.push(shot); continue; }
    shots.push(shotFromSyncFields(shot.id, merged, shot));
    changed = true;
  }

  for (const rem of remoteShots) {
    if (localIds.has(rem.id)) continue;
    const base = meta.shots[rem.id];
    if (base && base.revision === rem.revision) continue; // deleted here, delete is pushed later
    if (base) notices.push(`Frame ${rem.fields.frame} was changed on another device after you deleted it here, so it was restored.`);
    shots.push(shotFromSyncFields(rem.id, rem.fields));
    nextMeta.shots[rem.id] = { revision: rem.revision, fields: rem.fields, rollId: rem.rollId };
    changed = true;
  }

  if (!changed) return roll;
  shots.sort((a, b) => a.frame - b.frame);
  return { ...roll, shots };
}

/**
 * Push step: what this device needs to send, in a safe order (parents before
 * children on create, children before parents on delete). Records in conflict wait.
 */
export function pendingOps(local: Roll[], meta: SyncMeta, conflicts: SyncConflict[] = []): SyncOp[] {
  const blocked = new Set(conflicts.map((c) => `${c.kind}:${c.id}`));
  const blockedRolls = new Set(conflicts.map((c) => c.rollId));
  const goneRolls = new Set(conflicts.filter((c) => c.kind === "roll" && c.reason === "deleted-elsewhere").map((c) => c.id));
  const writesRoll: SyncOp[] = [];
  const writesShot: SyncOp[] = [];
  const deletesShot: SyncOp[] = [];
  const deletesRoll: SyncOp[] = [];
  const localRollIds = new Set(local.map((r) => r.id));
  const localShotIds = new Set(local.flatMap((r) => r.shots.map((s) => s.id)));

  for (const roll of local) {
    const base = meta.rolls[roll.id];
    const rollBlocked = blocked.has(`roll:${roll.id}`);
    if (!rollBlocked) {
      const fields = rollSyncFields(roll);
      if (!base) writesRoll.push({ type: "write-roll", id: roll.id, expected: null, fields });
      else if (!fieldsEqual(fields, base.fields)) writesRoll.push({ type: "write-roll", id: roll.id, expected: base.revision, fields });
    }
    // A roll that can't be created (or no longer exists in the cloud) can't take frames.
    if ((rollBlocked && !base) || goneRolls.has(roll.id)) continue;
    for (const shot of roll.shots) {
      if (blocked.has(`frame:${shot.id}`)) continue;
      const sb = meta.shots[shot.id];
      const fields = shotSyncFields(shot);
      if (!sb) writesShot.push({ type: "write-shot", id: shot.id, rollId: roll.id, expected: null, fields });
      else if (!fieldsEqual(fields, sb.fields)) writesShot.push({ type: "write-shot", id: shot.id, rollId: roll.id, expected: sb.revision, fields });
    }
  }

  for (const [id, sb] of Object.entries(meta.shots)) {
    if (localShotIds.has(id) || blockedRolls.has(sb.rollId)) continue;
    deletesShot.push({ type: "delete-shot", id, rollId: sb.rollId, expected: sb.revision, scanUri: (sb.fields.scan_uri as string | null) ?? null });
  }
  for (const [id, base] of Object.entries(meta.rolls)) {
    if (localRollIds.has(id) || blockedRolls.has(id)) continue;
    deletesRoll.push({ type: "delete-roll", id, expected: base.revision });
  }
  return [...writesRoll, ...writesShot, ...deletesShot, ...deletesRoll];
}

/** How many rolls and frames have changes this device hasn't sent yet. */
export function countPending(local: Roll[], meta: SyncMeta): number {
  return pendingOps(local, meta).length;
}

/**
 * Applies the user's choice for a conflict and returns the new local rolls and bases.
 * The chosen values become ordinary local edits on top of the cloud version, so the
 * next push sends exactly what was chosen.
 */
export function resolveConflict(
  local: Roll[],
  meta: SyncMeta,
  conflict: SyncConflict,
  choice: "local" | "remote" | Record<string, "local" | "remote">,
  newId: () => string,
): { rolls: Roll[]; meta: SyncMeta } {
  const nextMeta: SyncMeta = { rolls: { ...meta.rolls }, shots: { ...meta.shots } };

  if (conflict.reason === "deleted-elsewhere") {
    if (conflict.kind === "roll") {
      const roll = local.find((r) => r.id === conflict.rollId);
      delete nextMeta.rolls[conflict.rollId];
      for (const s of roll?.shots ?? []) delete nextMeta.shots[s.id];
      if (choice === "remote" || !roll) return { rolls: local.filter((r) => r.id !== conflict.rollId), meta: nextMeta };
      // Keep it: the old id is a tombstone on the server, so save it as a new roll.
      const copy: Roll = { ...roll, id: newId(), shots: roll.shots.map((s) => ({ ...s, id: newId() })) };
      return { rolls: local.map((r) => (r.id === roll.id ? copy : r)), meta: nextMeta };
    }
    delete nextMeta.shots[conflict.id];
    return {
      rolls: local.map((r) => r.id !== conflict.rollId ? r : {
        ...r,
        shots: choice === "remote"
          ? r.shots.filter((s) => s.id !== conflict.id)
          : r.shots.map((s) => (s.id === conflict.id ? { ...s, id: newId() } : s)),
      }),
      meta: nextMeta,
    };
  }

  const remote = conflict.remote!;
  const pick = (name: string) => (typeof choice === "string" ? choice : choice[name] ?? "local");

  if (conflict.kind === "roll") {
    const oldBase = meta.rolls[conflict.id]?.fields;
    nextMeta.rolls[conflict.id] = { revision: remote.revision, fields: remote.fields };
    return {
      rolls: local.map((r) => {
        if (r.id !== conflict.id) return r;
        const { merged } = mergeFields(rollSyncFields(r), remote.fields, oldBase);
        for (const f of conflict.fields) merged[f.name] = (pick(f.name) === "remote" ? remote.fields[f.name] : rollSyncFields(r)[f.name]) ?? null;
        return rollFromSyncFields(r.id, merged, r);
      }),
      meta: nextMeta,
    };
  }

  const oldShotBase = meta.shots[conflict.id]?.fields;
  nextMeta.shots[conflict.id] = { revision: remote.revision, fields: remote.fields, rollId: conflict.rollId };
  return {
    rolls: local.map((r) => r.id !== conflict.rollId ? r : {
      ...r,
      shots: r.shots.map((s) => {
        if (s.id !== conflict.id) return s;
        const own = shotSyncFields(s);
        const { merged } = mergeFields(own, remote.fields, oldShotBase);
        for (const f of conflict.fields) merged[f.name] = (pick(f.name) === "remote" ? remote.fields[f.name] : own[f.name]) ?? null;
        return shotFromSyncFields(s.id, merged, s);
      }).sort((a, b) => a.frame - b.frame),
    }),
    meta: nextMeta,
  };
}

/** Meta without the bases of one roll and its frames (they'll be uploaded as new). */
function stripRoll(meta: SyncMeta, roll: Roll): SyncMeta {
  const rolls = { ...meta.rolls };
  const shots = { ...meta.shots };
  delete rolls[roll.id];
  for (const s of roll.shots) delete shots[s.id];
  return { rolls, shots };
}
