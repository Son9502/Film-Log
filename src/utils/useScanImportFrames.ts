import { useRef, useState } from "react";
import { useFilmLogStore } from "@/store";
import { planMissingScanFrames, ScanAssignments } from "./scanImport";

export function useScanImportFrames() {
  const createScanImportFrames = useFilmLogStore((state) => state.createScanImportFrames);
  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);

  async function create(
    rollId: string,
    fileIds: string[],
    frames: number[],
    assignments: ScanAssignments,
  ): Promise<ScanAssignments | null> {
    if (creatingRef.current) return null;
    const plan = planMissingScanFrames(fileIds, frames, assignments);
    if (plan.frames.length === 0) return null;
    creatingRef.current = true;
    setCreating(true);
    try {
      await createScanImportFrames(rollId, plan.frames);
      return plan.assignments;
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  }
  return { create, creating };
}
