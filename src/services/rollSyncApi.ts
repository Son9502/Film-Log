// Network side of roll/frame sync. The decisions live in src/utils/rollMerge.ts.
import { supabase } from "./supabase";
import { dbToRoll, dbToShot, rollSyncFields, shotSyncFields } from "@/utils/rollRows";
import type { RemoteSnapshot, SyncOp } from "@/utils/rollMerge";

/** The database doesn't have the sync scripts (supabase/13–15) yet. */
export class SyncSetupError extends Error {
  constructor(detail: string) {
    super(`Cloud sync isn't set up yet: run supabase/13, 14 and 15 in the Supabase SQL Editor. (${detail})`);
    this.name = "SyncSetupError";
  }
}

const SETUP_CODES = new Set(["PGRST202", "PGRST204", "42883", "42703"]);

function check(error: { code?: string; message: string } | null, what: string): void {
  if (!error) return;
  if ((error.code && SETUP_CODES.has(error.code)) || /sync_revision|guarded_|roll_sync_tombstones/.test(error.message)) {
    throw new SyncSetupError(error.message);
  }
  throw new Error(`${what}: ${error.message}`);
}

const PAGE = 1000; // PostgREST's default row cap per request

async function fetchAll(table: "rolls" | "shots", userId: string): Promise<any[]> {
  const rows: any[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("user_id", userId)
      .order("id")
      .range(from, from + PAGE - 1);
    check(error, `Could not read cloud ${table}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

export async function fetchRollSnapshot(userId: string): Promise<RemoteSnapshot> {
  const [rolls, shots, tomb] = await Promise.all([
    fetchAll("rolls", userId),
    fetchAll("shots", userId),
    supabase.rpc("roll_sync_tombstones"),
  ]);
  check(tomb.error, "Could not read deletions");
  if (rolls.some((r) => typeof r.sync_revision !== "number")) throw new SyncSetupError("rolls.sync_revision is missing");
  return {
    rolls: rolls.map((row) => ({ id: row.id, revision: row.sync_revision, fields: rollSyncFields(dbToRoll(row)) })),
    shots: shots.map((row) => ({ id: row.id, rollId: row.roll_id, revision: row.sync_revision, fields: shotSyncFields(dbToShot(row)) })),
    tombstones: new Set(((tomb.data ?? []) as { kind: string; id: string }[]).map((t) => `${t.kind}:${t.id}`)),
  };
}

export type OpResult =
  | { status: "saved"; revision: number }
  | { status: "deleted" }
  | { status: "conflict" };

export async function runSyncOp(op: SyncOp): Promise<OpResult> {
  let res;
  switch (op.type) {
    case "write-roll":
      res = await supabase.rpc("guarded_roll_write", { p_id: op.id, p_expected_revision: op.expected, p_fields: op.fields });
      break;
    case "write-shot":
      res = await supabase.rpc("guarded_shot_write", { p_id: op.id, p_roll_id: op.rollId, p_expected_revision: op.expected, p_fields: op.fields });
      break;
    case "delete-shot":
      res = await supabase.rpc("guarded_shot_delete", { p_id: op.id, p_roll_id: op.rollId, p_expected_revision: op.expected });
      break;
    case "delete-roll":
      res = await supabase.rpc("guarded_roll_delete", { p_id: op.id, p_expected_revision: op.expected });
      break;
  }
  check(res.error, `Could not save ${op.type.replace("-", " ")}`);
  const data = res.data as { status: string; revision?: number };
  if (data?.status === "saved" && typeof data.revision === "number") return { status: "saved", revision: data.revision };
  if (data?.status === "deleted") return { status: "deleted" };
  // "conflict", and "has_frames" (a frame was added elsewhere): pull again and re-merge.
  return { status: "conflict" };
}
