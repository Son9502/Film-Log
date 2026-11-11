export type SyncRow = Record<string, unknown> & { id: string };

export interface SyncFieldDifference {
  name: string;
  device: unknown;
  cloud: unknown;
}

export interface SyncComparisonItem {
  kind: "roll" | "frame";
  id: string;
  rollId: string;
  presence: "device-only" | "cloud-only" | "different";
  deviceRollName: string | null;
  cloudRollName: string | null;
  deviceFrame: number | null;
  cloudFrame: number | null;
  fields: SyncFieldDifference[];
}

function compareRows(
  kind: SyncComparisonItem["kind"],
  local: SyncRow[],
  remote: SyncRow[],
  rollId: (row: SyncRow) => string,
  localRolls: Map<string, SyncRow>,
  remoteRolls: Map<string, SyncRow>,
): SyncComparisonItem[] {
  const localRows = new Map(local.map((row) => [row.id, row]));
  const remoteRows = new Map(remote.map((row) => [row.id, row]));
  const ids = new Set([...localRows.keys(), ...remoteRows.keys()]);
  const differences: SyncComparisonItem[] = [];

  for (const id of ids) {
    const device = localRows.get(id);
    const cloud = remoteRows.get(id);
    const row = device ?? cloud;
    if (!row) continue;
    const currentRollId = rollId(row);
    const deviceRoll = localRolls.get(device ? rollId(device) : currentRollId);
    const cloudRoll = remoteRolls.get(cloud ? rollId(cloud) : currentRollId);
    const keys = new Set([...Object.keys(device ?? {}), ...Object.keys(cloud ?? {})]);
    const fields = [...keys]
      .filter((key) => key !== "id" && key !== "user_id" && (
        !device || !cloud || JSON.stringify(device[key]) !== JSON.stringify(cloud[key])
      ))
      .map((name) => ({ name, device: device?.[name], cloud: cloud?.[name] }));
    if (!device || !cloud || fields.length) {
      differences.push({
        kind, id, rollId: currentRollId,
        presence: !device ? "cloud-only" : !cloud ? "device-only" : "different",
        deviceRollName: typeof deviceRoll?.name === "string" ? deviceRoll.name : null,
        cloudRollName: typeof cloudRoll?.name === "string" ? cloudRoll.name : null,
        deviceFrame: typeof device?.frame === "number" ? device.frame : null,
        cloudFrame: typeof cloud?.frame === "number" ? cloud.frame : null,
        fields,
      });
    }
  }
  return differences;
}

export function compareRollSyncRows(
  localRolls: SyncRow[], remoteRolls: SyncRow[],
  localShots: SyncRow[], remoteShots: SyncRow[],
): SyncComparisonItem[] {
  const deviceRolls = new Map(localRolls.map((row) => [row.id, row]));
  const cloudRolls = new Map(remoteRolls.map((row) => [row.id, row]));
  return [
    ...compareRows("roll", localRolls, remoteRolls, (row) => row.id, deviceRolls, cloudRolls),
    ...compareRows("frame", localShots, remoteShots, (row) => String(row.roll_id), deviceRolls, cloudRolls),
  ];
}

export function formatSyncValue(value: unknown): string {
  if (value === undefined) return "Not present";
  if (value === null) return "Not set";
  if (value === "") return '"" (empty)';
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}
