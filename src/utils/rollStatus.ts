// ── Roll status moves ────────────────────────────────────────────────────────
// Which statuses a roll can move to next. The base rules are NEXT_STATUSES; once a
// roll is at a lab and the drop-off says what the lab is doing, only the step that
// follows is offered.
import { NEXT_STATUSES } from "@/constants";
import type { LabDropoff, RollStatus } from "@/types";

export function nextStatusOptions(
  status: RollStatus,
  dropoff?: Pick<LabDropoff, "labScans"> | null,
): RollStatus[] {
  if (status === "In Lab" && dropoff) return dropoff.labScans ? ["Archived"] : ["In Scanning"];
  return [...(NEXT_STATUSES[status] ?? [])];
}

export function canMoveTo(
  from: RollStatus,
  to: RollStatus,
  dropoff?: Pick<LabDropoff, "labScans"> | null,
): boolean {
  return nextStatusOptions(from, dropoff).includes(to);
}

/** Batches develop rolls that are waiting to be developed or already in development. */
export const BATCH_STATUSES: readonly RollStatus[] = ["To Develop", "In Development"];
