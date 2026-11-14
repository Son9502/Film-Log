import type { Roll } from "@/types";
import { countPending, SyncConflict, SyncMeta } from "./rollMerge";

export const ACCOUNT_SWITCH_BLOCKED_MESSAGE =
  "This device has roll changes that haven't synced to the account that made them. " +
  "Sign in to that account and let it sync (Settings → Sync) before switching accounts.";

export interface AccountSyncState {
  rolls: Roll[];
  rollSyncMeta: SyncMeta;
  rollSyncOwner: string | null;
  syncConflicts: SyncConflict[];
}

/** Roll/frame changes on this device not yet in the cloud, plus unresolved conflicts. */
export function unsyncedRollChanges(state: AccountSyncState): number {
  return countPending(state.rolls, state.rollSyncMeta) + state.syncConflicts.length;
}

/**
 * Signing in as a different account wipes this device's data, so only allow it when
 * everything the previous account changed here has reached the cloud. A device that
 * has never signed in (no owner) keeps its data and syncs it to the first account.
 */
export function isAccountSwitchBlocked(storedUserId: string | null, incomingUserId: string, state: AccountSyncState): boolean {
  const owner = state.rollSyncOwner ?? storedUserId;
  if (owner === null || owner === incomingUserId) return false;
  return unsyncedRollChanges(state) > 0;
}
