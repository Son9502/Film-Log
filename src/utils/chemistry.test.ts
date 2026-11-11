import { chemSetStatus, chemSetWarning, parseDuration, applyBatchToRolls, batchForRoll, rollIdsForSet } from "./chemistry";
import type { ChemicalSet, DevBatch, Roll } from "@/types";

const set: ChemicalSet = {
  id: "s1", name: "D-76 jug", process: "B&W", chemistryId: "d76", chemistryName: "Kodak D-76",
  dilution: "Stock", mixedAt: "2026-01-01", capacityRolls: 10, shelfLifeDays: 90, rollsUsed: 4,
  createdAt: "", updatedAt: "",
};

describe("chemistry", () => {
  it("computes days and rolls left", () => {
    const st = chemSetStatus(set, "2026-02-01");
    expect(st.daysLeft).toBe(59);
    expect(st.rollsLeft).toBe(6);
    expect(chemSetWarning(set, "2026-02-01")).toBeNull();
  });
  it("warns when past shelf life or full", () => {
    expect(chemSetWarning(set, "2026-06-01")).toBe("Past shelf life");
    expect(chemSetWarning({ ...set, rollsUsed: 10 }, "2026-02-01")).toBe("At capacity");
    expect(chemSetWarning({ ...set, rollsUsed: 10 }, "2026-06-01")).toBe("Past shelf life and at capacity");
  });
  it("has no limits when none are set", () => {
    const open = { ...set, capacityRolls: undefined, shelfLifeDays: undefined };
    expect(chemSetWarning(open, "2030-01-01")).toBeNull();
  });
  it("parses durations", () => {
    expect(parseDuration("6:45")).toBe(405);
    expect(parseDuration("8")).toBe(480);
    expect(parseDuration("6:75")).toBeNull();
    expect(parseDuration("abc")).toBeNull();
  });
  it("writes batch details to only the batch's rolls", () => {
    const mk = (id: string): Roll => ({ id, status: "In Development", shots: [] } as unknown as Roll);
    const batch: DevBatch = {
      id: "b", chemicalSetId: "s1", process: "B&W", tempC: 20, timeSeconds: 405,
      developedAt: "2026-02-01", rollIds: ["a"], createdAt: "",
    };
    const [a, b] = applyBatchToRolls([mk("a"), mk("b")], batch, set, "now");
    expect(a).toMatchObject({ status: "In Scanning", developer: "Kodak D-76", dilution: "Stock", devTime: "6:45", devTemp: "20°C", developedAt: "2026-02-01" });
    expect(b.status).toBe("In Development");
  });
  it("writes push/pull, fixer and wetting agent from the batch", () => {
    const mk = (id: string): Roll => ({ id, status: "In Development", shots: [], pushPull: "+3" } as unknown as Roll);
    const batch: DevBatch = {
      id: "b", chemicalSetId: "s1", process: "B&W", tempC: 20, timeSeconds: 405,
      developedAt: "2026-02-01", rollIds: ["a", "b", "c"], fixer: "Ilford Rapid Fixer", wettingAgent: true, createdAt: "",
    };
    const [a, b, c] = applyBatchToRolls([mk("a"), mk("b"), mk("c")], batch, set, "now", { a: 1, b: 0 });
    expect(a).toMatchObject({ pushPull: "+1", fixer: "Ilford Rapid Fixer", photoFlo: true });
    expect(b.pushPull).toBeUndefined();
    expect(c.pushPull).toBe("+3");
  });
  it("finds a roll's batch and a set's rolls", () => {
    const base = { chemicalSetId: "s1", process: "B&W" as const, tempC: 20, timeSeconds: 400 };
    const batches: DevBatch[] = [
      { ...base, id: "old", developedAt: "2026-01-01", rollIds: ["a", "b"], createdAt: "1" },
      { ...base, id: "new", developedAt: "2026-02-01", rollIds: ["c", "a"], createdAt: "2" },
      { ...base, id: "other", chemicalSetId: "s2", developedAt: "2026-03-01", rollIds: ["d"], createdAt: "3" },
    ];
    expect(batchForRoll(batches, "a")?.id).toBe("new");
    expect(batchForRoll(batches, "z")).toBeUndefined();
    expect(rollIdsForSet(batches, "s1")).toEqual(["c", "a", "b"]);
  });
});
