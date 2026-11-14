import { compareRollSyncRows, formatSyncValue } from "./rollSyncComparison";

describe("compareRollSyncRows", () => {
  it("reports changed fields and records present on only one side", () => {
    const localRolls = [
      { id: "shared", name: "Local", status: "Shooting" },
      { id: "local", name: "Offline" },
    ];
    const remoteRolls = [
      { id: "shared", name: "Cloud", status: "Shooting" },
      { id: "remote", name: "Other device" },
    ];
    const localShots = [{ id: "shot", roll_id: "shared", frame: 1, notes: "local" }];
    const remoteShots = [
      { id: "shot", roll_id: "shared", frame: 1, notes: "cloud" },
      { id: "remote-shot", roll_id: "remote", frame: 1 },
    ];
    expect(compareRollSyncRows(localRolls, remoteRolls, localShots, remoteShots)).toEqual([
      { kind: "roll", id: "shared", rollId: "shared", presence: "different", deviceRollName: "Local", cloudRollName: "Cloud", deviceFrame: null, cloudFrame: null, fields: [{ name: "name", device: "Local", cloud: "Cloud" }] },
      { kind: "roll", id: "local", rollId: "local", presence: "device-only", deviceRollName: "Offline", cloudRollName: null, deviceFrame: null, cloudFrame: null, fields: [{ name: "name", device: "Offline", cloud: undefined }] },
      { kind: "roll", id: "remote", rollId: "remote", presence: "cloud-only", deviceRollName: null, cloudRollName: "Other device", deviceFrame: null, cloudFrame: null, fields: [{ name: "name", device: undefined, cloud: "Other device" }] },
      { kind: "frame", id: "shot", rollId: "shared", presence: "different", deviceRollName: "Local", cloudRollName: "Cloud", deviceFrame: 1, cloudFrame: 1, fields: [{ name: "notes", device: "local", cloud: "cloud" }] },
      { kind: "frame", id: "remote-shot", rollId: "remote", presence: "cloud-only", deviceRollName: null, cloudRollName: "Other device", deviceFrame: null, cloudFrame: 1, fields: [{ name: "roll_id", device: undefined, cloud: "remote" }, { name: "frame", device: undefined, cloud: 1 }] },
    ]);
  });

  it("returns no differences for equal records and never mutates its inputs", () => {
    const local = [{ id: "1", name: null, frame: 1 }];
    const remote = [{ ...local[0] }];
    expect(compareRollSyncRows(local, remote, [], [])).toEqual([]);
    expect(local).toEqual([{ id: "1", name: null, frame: 1 }]);
  });

  it("displays null, missing, empty, boolean and numeric values distinctly", () => {
    expect([undefined, null, "", false, true, 0].map(formatSyncValue)).toEqual([
      "Not present", "Not set", '"" (empty)', "No", "Yes", "0",
    ]);
  });

  it("shows differing frame numbers and fields missing from one row", () => {
    const result = compareRollSyncRows(
      [{ id: "r", name: null }], [{ id: "r", name: null }],
      [{ id: "s", roll_id: "r", frame: 1, flash: false }],
      [{ id: "s", roll_id: "r", frame: 2 }],
    );
    expect(result[0]).toMatchObject({
      deviceRollName: null, cloudRollName: null, deviceFrame: 1, cloudFrame: 2,
      fields: [
        { name: "frame", device: 1, cloud: 2 },
        { name: "flash", device: false, cloud: undefined },
      ],
    });
  });
});
