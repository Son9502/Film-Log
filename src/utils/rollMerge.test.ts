import type { Roll, Shot } from "@/types";
import { rollSyncFields, shotSyncFields } from "./rollRows";
import {
  emptyMeta, mergeFields, pendingOps, reconcile, resolveConflict,
  RemoteSnapshot, SyncMeta,
} from "./rollMerge";

const shot = (id: string, frame: number, extra: Partial<Shot> = {}): Shot => ({ id, frame, ...extra });
const roll = (id: string, extra: Partial<Roll> = {}): Roll => ({
  id, filmStockId: "film", cameraId: "cam", iso: "400", frameCount: 36, status: "Shooting",
  loadedAt: "2026-01-01", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
  shots: [], ...extra,
});

/** Meta as if `rolls` were synced at revision `rev`. */
function syncedMeta(rolls: Roll[], rev = 1): SyncMeta {
  const meta = emptyMeta();
  for (const r of rolls) {
    meta.rolls[r.id] = { revision: rev, fields: rollSyncFields(r) };
    for (const s of r.shots) meta.shots[s.id] = { revision: rev, fields: shotSyncFields(s), rollId: r.id };
  }
  return meta;
}

/** Cloud snapshot holding `rolls`, each at revision `rev`. */
function cloud(rolls: Roll[], rev = 1, tombstones: string[] = []): RemoteSnapshot {
  return {
    rolls: rolls.map((r) => ({ id: r.id, revision: rev, fields: rollSyncFields(r) })),
    shots: rolls.flatMap((r) => r.shots.map((s) => ({ id: s.id, rollId: r.id, revision: rev, fields: shotSyncFields(s) }))),
    tombstones: new Set(tombstones),
  };
}

describe("mergeFields", () => {
  const base = { name: "a", notes: "x", status: "Shooting", updated_at: "1" };

  it("takes each side's change when they touch different fields", () => {
    const { merged, conflicts } = mergeFields(
      { ...base, name: "phone", updated_at: "2" },
      { ...base, notes: "web", updated_at: "3" },
      base,
    );
    expect(conflicts).toEqual([]);
    expect(merged).toEqual({ name: "phone", notes: "web", status: "Shooting", updated_at: "3" });
  });

  it("reports a conflict only when the same field changed differently", () => {
    const { conflicts } = mergeFields({ ...base, name: "phone" }, { ...base, name: "web" }, base);
    expect(conflicts).toEqual([{ name: "name", local: "phone", remote: "web" }]);
  });

  it("on a first sync, fills gaps from either side and flags real differences", () => {
    const { merged, conflicts } = mergeFields(
      { name: "a", notes: null, status: "Archived" },
      { name: "a", notes: "cloud note", status: "In Scanning" },
      undefined,
    );
    expect(merged.notes).toBe("cloud note");
    expect(conflicts.map((c) => c.name)).toEqual(["status"]);
  });
});

describe("reconcile + pendingOps", () => {
  it("pushes brand-new local rolls and frames as creates, roll first", () => {
    const r = roll("r1", { shots: [shot("s1", 1)] });
    const result = reconcile([r], emptyMeta(), cloud([]));
    expect(result.conflicts).toEqual([]);
    expect(pendingOps(result.rolls, result.meta).map((o) => [o.type, o.id, "expected" in o ? o.expected : null]))
      .toEqual([["write-roll", "r1", null], ["write-shot", "s1", null]]);
  });

  it("pulls a cloud edit when nothing changed here", () => {
    const r = roll("r1", { shots: [shot("s1", 1)] });
    const edited = roll("r1", { name: "From web", shots: [shot("s1", 1, { notes: "web note" })] });
    const result = reconcile([r], syncedMeta([r]), cloud([edited], 2));
    expect(result.rolls[0].name).toBe("From web");
    expect(result.rolls[0].shots[0].notes).toBe("web note");
    expect(result.meta.rolls.r1.revision).toBe(2);
    expect(pendingOps(result.rolls, result.meta)).toEqual([]);
  });

  it("merges a phone frame edit with a web scan upload on the same frame", () => {
    const base = roll("r1", { shots: [shot("s1", 1)] });
    const phone = roll("r1", { shots: [shot("s1", 1, { notes: "phone note" })] });
    const web = roll("r1", { shots: [shot("s1", 1, { scanUri: "u/r1/s1.jpg" })] });
    const result = reconcile([phone], syncedMeta([base]), cloud([web], 2));
    expect(result.conflicts).toEqual([]);
    expect(result.rolls[0].shots[0]).toMatchObject({ notes: "phone note", scanUri: "u/r1/s1.jpg" });
    const ops = pendingOps(result.rolls, result.meta);
    expect(ops).toEqual([expect.objectContaining({ type: "write-shot", id: "s1", expected: 2 })]);
  });

  it("holds back a record edited differently on both sides until it's resolved", () => {
    const base = roll("r1");
    const phone = roll("r1", { status: "Archived" });
    const web = roll("r1", { status: "In Lab" });
    const result = reconcile([phone], syncedMeta([base]), cloud([web], 2));
    expect(result.conflicts).toEqual([expect.objectContaining({ kind: "roll", reason: "edited-both", fields: [{ name: "status", local: "Archived", remote: "In Lab" }] })]);
    expect(result.meta.rolls.r1.revision).toBe(1); // base not advanced
    expect(pendingOps(result.rolls, result.meta, result.conflicts)).toEqual([]);

    const resolved = resolveConflict(result.rolls, result.meta, result.conflicts[0], "remote", () => "x");
    expect(resolved.rolls[0].status).toBe("In Lab");
    expect(pendingOps(resolved.rolls, resolved.meta)).toEqual([]);

    const keptMine = resolveConflict(result.rolls, result.meta, result.conflicts[0], "local", () => "x");
    expect(pendingOps(keptMine.rolls, keptMine.meta)).toEqual([
      expect.objectContaining({ type: "write-roll", expected: 2, fields: expect.objectContaining({ status: "Archived" }) }),
    ]);
  });

  it("keeps non-conflicting changes from both sides when resolving per field", () => {
    const base = roll("r1");
    const phone = roll("r1", { status: "Archived", notes: "phone" });
    const web = roll("r1", { status: "In Lab", name: "web name" });
    const result = reconcile([phone], syncedMeta([base]), cloud([web], 2));
    const resolved = resolveConflict(result.rolls, result.meta, result.conflicts[0], { status: "remote" }, () => "x");
    expect(resolved.rolls[0]).toMatchObject({ status: "In Lab", notes: "phone", name: "web name" });
  });

  it("deletes here what was deleted elsewhere, if it wasn't edited here", () => {
    const r = roll("r1", { shots: [shot("s1", 1)] });
    const result = reconcile([r], syncedMeta([r]), cloud([], 1, ["roll:r1", "frame:s1"]));
    expect(result.rolls).toEqual([]);
    expect(result.meta).toEqual(emptyMeta());
    expect(result.notices[0]).toMatch(/deleted on another device/);
  });

  it("keeps and re-uploads a synced roll that's missing from the cloud without a tombstone", () => {
    const r = roll("r1", { shots: [shot("s1", 1)] });
    const result = reconcile([r], syncedMeta([r]), cloud([], 1));
    expect(result.rolls).toEqual([r]);
    expect(result.notices).toEqual([]);
    const ops = pendingOps(result.rolls, result.meta, result.conflicts);
    expect(ops.map((o) => o.type)).toEqual(["write-roll", "write-shot"]);
    expect(ops.every((o) => "expected" in o && o.expected == null)).toBe(true);
  });

  it("asks before dropping a roll deleted elsewhere but edited here", () => {
    const r = roll("r1", { shots: [shot("s1", 1)] });
    const edited = { ...r, name: "edited offline" };
    const result = reconcile([edited], syncedMeta([r]), cloud([], 1, ["roll:r1"]));
    expect(result.conflicts).toEqual([expect.objectContaining({ kind: "roll", reason: "deleted-elsewhere" })]);
    expect(pendingOps(result.rolls, result.meta, result.conflicts)).toEqual([]);

    let n = 0;
    const kept = resolveConflict(result.rolls, result.meta, result.conflicts[0], "local", () => `new-${++n}`);
    expect(kept.rolls[0]).toMatchObject({ id: "new-1", name: "edited offline", shots: [{ id: "new-2" }] });
    expect(pendingOps(kept.rolls, kept.meta).map((o) => o.type)).toEqual(["write-roll", "write-shot"]);
  });

  it("pushes guarded deletes for a roll deleted here, frames before the roll", () => {
    const r = roll("r1", { shots: [shot("s1", 1, { scanUri: "u/r1/s1.jpg" })] });
    const result = reconcile([], syncedMeta([r], 4), cloud([r], 4));
    expect(result.rolls).toEqual([]);
    expect(pendingOps(result.rolls, result.meta)).toEqual([
      { type: "delete-shot", id: "s1", rollId: "r1", expected: 4, scanUri: "u/r1/s1.jpg" },
      { type: "delete-roll", id: "r1", expected: 4 },
    ]);
  });

  it("restores a roll deleted here if another device changed it meanwhile", () => {
    const r = roll("r1", { shots: [shot("s1", 1)] });
    const changed = roll("r1", { shots: [shot("s1", 1, { notes: "added on web" })] });
    const remote = cloud([changed], 1);
    remote.shots[0].revision = 2;
    const result = reconcile([], syncedMeta([r]), remote);
    expect(result.rolls[0].shots[0].notes).toBe("added on web");
    expect(result.notices[0]).toMatch(/restored/);
    expect(pendingOps(result.rolls, result.meta)).toEqual([]);
  });

  it("adds rolls created on another device", () => {
    const r = roll("r2", { name: "Phone roll", shots: [shot("b", 2), shot("a", 1)] });
    const result = reconcile([], emptyMeta(), cloud([r], 3));
    expect(result.rolls[0]).toMatchObject({ id: "r2", name: "Phone roll" });
    expect(result.rolls[0].shots.map((s) => s.frame)).toEqual([1, 2]);
    expect(result.meta.shots.a).toMatchObject({ revision: 3, rollId: "r2" });
  });

  it("adopts identical records on the first sync without writing", () => {
    const r = roll("r1", { shots: [shot("s1", 1, { notes: "same" })] });
    const result = reconcile([r], emptyMeta(), cloud([r], 7));
    expect(result.conflicts).toEqual([]);
    expect(pendingOps(result.rolls, result.meta)).toEqual([]);
  });

  it("treats a newer updated_at as a non-conflict", () => {
    const base = roll("r1", { shots: [shot("s1", 1)] });
    const phone = { ...base, updatedAt: "2026-02-01T00:00:00Z", shots: [shot("s1", 1, { notes: "p" })] };
    const web = { ...base, updatedAt: "2026-03-01T00:00:00Z", shots: [shot("s1", 1, { rating: 4 })] };
    const result = reconcile([phone], syncedMeta([base]), cloud([web], 2));
    expect(result.conflicts).toEqual([]);
    expect(result.rolls[0].updatedAt).toBe("2026-03-01T00:00:00Z");
    expect(result.rolls[0].shots[0]).toMatchObject({ notes: "p", rating: 4 });
  });
});
