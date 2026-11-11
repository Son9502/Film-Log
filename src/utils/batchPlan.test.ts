import { planBatch } from "./batchPlan";
import { matchFilm, stockProcess } from "./filmMatch";
import { ChemicalSet, FilmStock, Roll } from "@/types";
import { DEFAULT_FILM_STOCKS } from "@/constants";

const stocks: FilmStock[] = [
  ...DEFAULT_FILM_STOCKS,
  { id: "vision3-500t", name: "Kodak Vision3 500T", iso: 500, isCustom: true },
  { id: "mystery", name: "Mystery Film", iso: 400, isCustom: true },
  { id: "home-c41", name: "Some Colour Film", iso: 200, isCustom: true, process: "C-41" },
];
const roll = (id: string, filmStockId: string, iso: string): Roll =>
  ({ id, filmStockId, iso, cameraId: "c", frameCount: 36, status: "To Develop", loadedAt: "2026-01-01", shots: [], createdAt: "", updatedAt: "" } as Roll);

const bwSet = (): ChemicalSet => ({
  id: "s", name: "D-76", process: "B&W", chemistryId: "kodak-d-76-ilford-id-11", chemistryName: "Kodak D-76",
  dilution: "Stock", mixedAt: "2026-11-01", rollsUsed: 0, createdAt: "", updatedAt: "",
});

describe("matchFilm", () => {
  it("matches default stocks to reference data", () => {
    expect(matchFilm({ name: "Ilford HP5 Plus", iso: 400 })?.process).toBe("B&W");
    expect(matchFilm({ name: "Kodak Portra 400", iso: 400 })?.process).toBe("C-41");
    expect(matchFilm({ name: "Kodak Gold 200", iso: 200 })?.process).toBe("C-41");
    expect(matchFilm({ name: "Fuji Superia 400", iso: 400 })?.process).toBe("C-41");
    expect(matchFilm({ name: "Fuji Velvia 50", iso: 50 })?.process).toBe("E-6");
    expect(matchFilm({ name: "Kodak Vision3 500T", iso: 500 })?.hasRemjet).toBe(true);
    expect(matchFilm({ name: "Mystery Film", iso: 400 })).toBeNull();
  });
});

describe("stockProcess", () => {
  it("prefers the process set on the stock, then the reference data", () => {
    expect(stockProcess({ name: "Some Colour Film", iso: 200, process: "C-41" })).toBe("C-41");
    expect(stockProcess({ name: "Ilford HP5 Plus", iso: 400 })).toBe("B&W");
    expect(stockProcess({ name: "Mystery Film", iso: 400 })).toBeNull();
    expect(stockProcess(undefined)).toBeNull();
  });
});

describe("planBatch", () => {
  const today = "2026-11-04";
  it("blocks remjet mixed with non-remjet", () => {
    const set: ChemicalSet = { ...bwSet(), process: "ECN-2", chemistryId: "ecn-2-home-ecn-2-kit", chemistryName: "Home ECN-2 kit", dilution: undefined };
    const p = planBatch({ rolls: [roll("a", "vision3-500t", "500"), roll("b", "portra-400", "400")], stocks, set, today });
    expect(p.blockers.join(" ")).toMatch(/Remjet/);
  });

  it("blocks different processes", () => {
    const p = planBatch({ rolls: [roll("a", "hp5-plus", "400"), roll("b", "portra-400", "400")], stocks, set: bwSet(), today });
    expect(p.blockers.join(" ")).toMatch(/different processes/);
  });

  it("blocks a film whose user-set process doesn't match the chemistry", () => {
    const p = planBatch({ rolls: [roll("a", "home-c41", "200")], stocks, set: bwSet(), today });
    expect(p.blockers.join(" ")).toMatch(/C-41 film but the chemical set is B&W/);
  });

  it("plans identical rolls together and blocks different push times", () => {
    const same = planBatch({ rolls: [roll("a", "hp5-plus", "400"), roll("b", "hp5-plus", "400")], stocks, set: bwSet(), today });
    expect(same.blockers).toEqual([]);
    expect(same.seconds).toBe(450);
    const pushed = planBatch({ rolls: [roll("a", "hp5-plus", "400"), roll("b", "hp5-plus", "1600")], stocks, set: bwSet(), today });
    expect(pushed.blockers).toEqual([]);
    expect(pushed.timeMismatch).toBe(true);
    expect(pushed.seconds).toBeNull();
    expect(pushed.warnings[0]).toMatch(/pushed\/pulled by different amounts/);
  });

  it("blocks films with different base times", () => {
    const p = planBatch({ rolls: [roll("a", "hp5-plus", "400"), roll("b", "trix-400", "400")], stocks, set: bwSet(), today });
    expect(p.blockers).toEqual([]);
    expect(p.warnings[0]).toMatch(/need different times.*Split them/);
  });

  it("warns when a set is over capacity", () => {
    const set = { ...bwSet(), capacityRolls: 1 };
    const p = planBatch({ rolls: [roll("a", "mystery", "400"), roll("b", "mystery", "400")], stocks, set, today });
    expect(p.warnings.join(" ")).toMatch(/capacity/);
    expect(p.warnings.join(" ")).toMatch(/No reference data/);
  });
});
