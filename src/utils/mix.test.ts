import { mixFor, minimumWarning, parseDilution } from "./mix";

describe("parseDilution", () => {
  it("reads common dilution formats", () => {
    expect(parseDilution("1+1")).toEqual({ stock: 1, water: 1 });
    expect(parseDilution("1:50")).toEqual({ stock: 1, water: 50 });
    expect(parseDilution("Dil. B (1+31)")).toEqual({ stock: 1, water: 31 });
    expect(parseDilution("Stock")).toEqual({ stock: 1, water: 0 });
  });

  it("returns null for text it can't read", () => {
    expect(parseDilution(undefined)).toBeNull();
    expect(parseDilution("strong")).toBeNull();
  });
});

describe("mixFor", () => {
  it("splits working solution into concentrate and water", () => {
    expect(mixFor(600, "1+1")).toEqual({ concentrateMl: 300, waterMl: 300 });
    expect(mixFor(500, "1+4")).toEqual({ concentrateMl: 100, waterMl: 400 });
    expect(mixFor(300, "Stock")).toEqual({ concentrateMl: 300, waterMl: 0 });
  });

  it("keeps a decimal for very dilute mixes", () => {
    expect(mixFor(300, "1+100")).toEqual({ concentrateMl: 3, waterMl: 297 });
    expect(mixFor(510, "1+50")).toEqual({ concentrateMl: 10, waterMl: 500 });
    expect(mixFor(290, "1+31")).toEqual({ concentrateMl: 9.1, waterMl: 281 });
  });

  it("returns null without a volume or a readable dilution", () => {
    expect(mixFor(0, "1+1")).toBeNull();
    expect(mixFor(300, "")).toBeNull();
  });
});

describe("minimumWarning", () => {
  it("warns when concentrate is below the per-roll minimum", () => {
    const mix = mixFor(300, "1+100");
    expect(minimumWarning(mix, 1, 5)).toMatch(/needs at least 5 ml/);
  });

  it("is quiet when there's enough or no minimum is set", () => {
    expect(minimumWarning(mixFor(600, "1+1"), 2, 100)).toBeNull();
    expect(minimumWarning(mixFor(300, "1+100"), 1, undefined)).toBeNull();
  });
});
