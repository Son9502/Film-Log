import { monthSummary } from "./summary";
import { filterRolls } from "./rollFilter";
import { rollsToCsv, framesToCsv } from "./exportCsv";
import { Roll } from "@/types";

const roll = (o: Partial<Roll>): Roll => ({
  id: "r1", filmStockId: "f1", cameraId: "c1", iso: "400", frameCount: 36, status: "Shooting",
  loadedAt: "2026-11-02", shots: [], createdAt: "", updatedAt: "", ...o,
} as Roll);

const names = { film: (id: string) => `Film ${id}`, camera: (id: string) => `Cam ${id}` };
const now = new Date(2026, 10, 15);

describe("monthSummary", () => {
  it("counts this month only and totals spend", () => {
    const rolls = [roll({ id: "a" }), roll({ id: "b" }), roll({ id: "c", loadedAt: "2026-10-30", filmStockId: "f2" })];
    const s = monthSummary(
      rolls,
      [{ price: 30, purchasedAt: "2026-11-01" }, { price: 99, purchasedAt: "2026-09-01" }] as any,
      [{ cost: 12.5, droppedOffAt: "2026-11-10" }] as any,
      [{ id: "f1", name: "Portra" }] as any,
      now
    );
    expect(s.rollsLoaded).toBe(2);
    expect(s.topStocks).toEqual([{ name: "Portra", rolls: 2 }]);
    expect(s.totalSpend).toBe(42.5);
  });
});

describe("filterRolls", () => {
  const rolls = [
    roll({ id: "a", name: "Yosemite", status: "Archived" }),
    roll({ id: "b", cameraId: "c2", loadedAt: "2026-06-01" }),
  ];
  it("filters by status, camera, date and text", () => {
    expect(filterRolls(rolls, { status: "Archived" }, names).map((r) => r.id)).toEqual(["a"]);
    expect(filterRolls(rolls, { cameraId: "c2" }, names).map((r) => r.id)).toEqual(["b"]);
    expect(filterRolls(rolls, { from: "2026-07-01" }, names).map((r) => r.id)).toEqual(["a"]);
    expect(filterRolls(rolls, { query: "yosem" }, names).map((r) => r.id)).toEqual(["a"]);
    expect(filterRolls(rolls, { query: "cam c2" }, names).map((r) => r.id)).toEqual(["b"]);
  });
});

describe("csv", () => {
  it("escapes commas and quotes", () => {
    const r = roll({ name: 'Say "hi", ok', shots: [{ id: "s", frame: 1, notes: "a,b" }] as any });
    expect(rollsToCsv([r], names).split("\n")[1]).toContain('"Say ""hi"", ok"');
    expect(framesToCsv([r], names).split("\n")[1]).toContain('"a,b"');
  });
});
