import type { Roll } from "@/types";
import { rollSyncFields } from "./rollRows";
import { emptyMeta } from "./rollMerge";
import { AccountSyncState, isAccountSwitchBlocked } from "./accountSyncSafety";

const roll = { id: "r1", filmStockId: "f", cameraId: "c", iso: "400", frameCount: 36, status: "Shooting",
  loadedAt: "2026-01-01", createdAt: "2026-01-01", updatedAt: "2026-01-01", shots: [] } as Roll;

const synced: AccountSyncState = {
  rolls: [roll],
  rollSyncMeta: { rolls: { r1: { revision: 1, fields: rollSyncFields(roll) } }, shots: {} },
  rollSyncOwner: "owner",
  syncConflicts: [],
};

describe("account switch safety", () => {
  it("allows the same account, or a different one once everything has synced", () => {
    expect(isAccountSwitchBlocked("owner", "owner", synced)).toBe(false);
    expect(isAccountSwitchBlocked("owner", "other", synced)).toBe(false);
  });

  it("blocks a different account while changes are unsynced or in conflict", () => {
    const edited = { ...synced, rolls: [{ ...roll, name: "offline edit" }] };
    expect(isAccountSwitchBlocked("owner", "other", edited)).toBe(true);
    const conflicted = { ...synced, syncConflicts: [{ kind: "roll" as const, id: "r1", rollId: "r1", reason: "edited-both" as const, fields: [] }] };
    expect(isAccountSwitchBlocked("owner", "other", conflicted)).toBe(true);
  });

  it("lets a device that never signed in adopt its local rolls into the first account", () => {
    const fresh = { ...synced, rollSyncMeta: emptyMeta(), rollSyncOwner: null };
    expect(isAccountSwitchBlocked(null, "first", fresh)).toBe(false);
  });
});
