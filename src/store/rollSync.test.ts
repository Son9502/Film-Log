import { useFilmLogStore } from "./index";
import { fetchRollSnapshot, runSyncOp, SyncSetupError } from "@/services/rollSyncApi";
import { deleteScan } from "@/services/supabase";
import { rollSyncFields, shotSyncFields } from "@/utils/rollRows";
import { emptyMeta, RemoteSnapshot, SyncMeta } from "@/utils/rollMerge";
import type { Roll } from "@/types";

jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("@/services/supabase", () => ({
  supabase: { from: jest.fn(), channel: jest.fn(), removeChannel: jest.fn(), rpc: jest.fn() },
  deleteScan: jest.fn(async () => {}),
}));
jest.mock("@/services/rollSyncApi", () => {
  class SyncSetupError extends Error {}
  return { fetchRollSnapshot: jest.fn(), runSyncOp: jest.fn(), SyncSetupError };
});

const roll: Roll = {
  id: "r1", filmStockId: "film", cameraId: "cam", iso: "400", frameCount: 36, status: "In Scanning",
  loadedAt: "2026-01-01", createdAt: "2026-01-01", updatedAt: "2026-01-01",
  shots: [{ id: "s1", frame: 1, scanUri: "u/r1/s1.jpg" }],
};

function snapshotOf(rolls: Roll[], rev: number): RemoteSnapshot {
  return {
    rolls: rolls.map((r) => ({ id: r.id, revision: rev, fields: rollSyncFields(r) })),
    shots: rolls.flatMap((r) => r.shots.map((s) => ({ id: s.id, rollId: r.id, revision: rev, fields: shotSyncFields(s) }))),
    tombstones: new Set(),
  };
}

function metaOf(rolls: Roll[], rev: number): SyncMeta {
  const meta = emptyMeta();
  for (const r of rolls) {
    meta.rolls[r.id] = { revision: rev, fields: rollSyncFields(r) };
    for (const s of r.shots) meta.shots[s.id] = { revision: rev, fields: shotSyncFields(s), rollId: r.id };
  }
  return meta;
}

beforeEach(() => {
  jest.clearAllMocks();
  useFilmLogStore.setState({
    user: { id: "user-1", email: "t@example.com" },
    rolls: [roll],
    cameras: [{ id: "cam", name: "Cam", isCustom: false }],
    filmStocks: [{ id: "film", name: "Film", iso: 400, isCustom: false }],
    rollSyncMeta: metaOf([roll], 1),
    rollSyncOwner: "user-1",
    rollSync: { state: "idle" },
    syncConflicts: [],
    syncNotices: [],
    persist: jest.fn(async () => {}),
  });
});

it("pushes a local edit guarded by the last synced revision", async () => {
  useFilmLogStore.setState({ rolls: [{ ...roll, name: "Renamed" }] });
  jest.mocked(fetchRollSnapshot).mockResolvedValue(snapshotOf([roll], 1));
  jest.mocked(runSyncOp).mockResolvedValue({ status: "saved", revision: 2 });

  await useFilmLogStore.getState().runRollSync();

  expect(runSyncOp).toHaveBeenCalledWith(expect.objectContaining({ type: "write-roll", id: "r1", expected: 1 }));
  const st = useFilmLogStore.getState();
  expect(st.rollSyncMeta.rolls.r1).toMatchObject({ revision: 2, fields: expect.objectContaining({ name: "Renamed" }) });
  expect(st.rollSync.state).toBe("idle");
});

it("re-pulls after a stale write and merges the other device's change", async () => {
  useFilmLogStore.setState({ rolls: [{ ...roll, name: "Phone name" }] });
  const web = { ...roll, notes: "web note" };
  jest.mocked(fetchRollSnapshot)
    .mockResolvedValueOnce(snapshotOf([roll], 1))   // first look: nothing new
    .mockResolvedValueOnce(snapshotOf([web], 2));   // after the conflict: web edit visible
  jest.mocked(runSyncOp)
    .mockResolvedValueOnce({ status: "conflict" })
    .mockResolvedValueOnce({ status: "saved", revision: 3 });

  await useFilmLogStore.getState().runRollSync();

  expect(runSyncOp).toHaveBeenLastCalledWith(expect.objectContaining({ type: "write-roll", expected: 2 }));
  expect(useFilmLogStore.getState().rolls[0]).toMatchObject({ name: "Phone name", notes: "web note" });
  expect(useFilmLogStore.getState().syncConflicts).toEqual([]);
});

it("deletes an old scan file only after the cloud accepts the frame change", async () => {
  useFilmLogStore.setState({ rolls: [{ ...roll, shots: [{ id: "s1", frame: 1 }] }] });
  jest.mocked(fetchRollSnapshot).mockResolvedValue(snapshotOf([roll], 1));
  jest.mocked(runSyncOp).mockResolvedValueOnce({ status: "conflict" }).mockResolvedValue({ status: "saved", revision: 2 });

  // A conflicted write must not delete the file.
  jest.mocked(fetchRollSnapshot).mockResolvedValueOnce(snapshotOf([roll], 1)).mockResolvedValueOnce(snapshotOf([roll], 1));
  await useFilmLogStore.getState().runRollSync();

  expect(deleteScan).toHaveBeenCalledTimes(1);
  expect(deleteScan).toHaveBeenCalledWith("u/r1/s1.jpg");
  const writes = jest.mocked(runSyncOp).mock.calls.map(([op]) => op.type);
  expect(writes).toEqual(["write-shot", "write-shot"]);
});

it("keeps changes on the device when the database isn't set up", async () => {
  useFilmLogStore.setState({ rolls: [{ ...roll, name: "Offline edit" }] });
  jest.mocked(fetchRollSnapshot).mockRejectedValue(new SyncSetupError("missing"));

  await useFilmLogStore.getState().runRollSync();

  const st = useFilmLogStore.getState();
  expect(st.rollSync.state).toBe("setup-needed");
  expect(st.rolls[0].name).toBe("Offline edit");
  expect(st.unsyncedRollChanges()).toBe(1);
  expect(runSyncOp).not.toHaveBeenCalled();
});

it("refuses to wipe the device for another account while changes are unsynced", () => {
  useFilmLogStore.setState({ rolls: [{ ...roll, name: "Not synced yet" }] });
  expect(() => useFilmLogStore.getState().clearAllData()).toThrow("haven't synced");
  useFilmLogStore.setState({ rolls: [roll] });
  expect(() => useFilmLogStore.getState().clearAllData()).not.toThrow();
  expect(useFilmLogStore.getState().rolls).toEqual([]);
});

it("adds frames for a scan import locally, in order, and extends the frame count", async () => {
  useFilmLogStore.setState({ user: null });
  await useFilmLogStore.getState().createScanImportFrames("r1", [37, 2]);
  const r = useFilmLogStore.getState().rolls[0];
  expect(r.shots.map((s) => s.frame)).toEqual([1, 2, 37]);
  expect(r.frameCount).toBe(37);
  await expect(useFilmLogStore.getState().createScanImportFrames("r1", [2])).rejects.toThrow("already in use");
});
