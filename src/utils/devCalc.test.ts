import { calculateDevTime, calculateKitTime, tempFactor, curveValue, buildSteps, formatDuration, stopsFromBox, pushLabel, DevRecipe } from "./devCalc";
import { PUSH_CURVES, bwPushCurve, BW_TEMP_CHART, BW_RECIPES, COLOR_KITS } from "@/constants/devData";

const recipes: DevRecipe[] = [
  { id: "1", filmStockId: "tx", developerId: "d76", dilution: "Stock", exposureIso: 400, tempC: 20, timeSeconds: 600, agitation: "a", push: true, pull: true },
  { id: "2", filmStockId: "*", developerId: "stand", dilution: "1+100", exposureIso: 0, tempC: 20, timeSeconds: 3600, agitation: "a", push: false, pull: false },
  { id: "3", filmStockId: "fp", developerId: "perc", dilution: "Stock", exposureIso: 64, tempC: 20, timeSeconds: 420, agitation: "a", push: false, pull: true },
];
const base = { recipes, filmStockId: "tx", developerId: "d76", dilution: "Stock", tempC: 20, pushCurve: PUSH_CURVES.bwStandard };

describe("devCalc", () => {
  it("returns the base time at box speed", () => {
    expect(calculateDevTime({ ...base, shotIso: 400 })?.timeSeconds).toBe(600);
  });
  it("returns null with no matching recipe", () => {
    expect(calculateDevTime({ ...base, shotIso: 400, dilution: "1+1" })).toBeNull();
  });
  it("applies the push and pull multipliers", () => {
    expect(calculateDevTime({ ...base, shotIso: 800 })?.timeSeconds).toBe(900);
    expect(calculateDevTime({ ...base, shotIso: 1600 })?.timeSeconds).toBe(1350);
    expect(calculateDevTime({ ...base, shotIso: 3200 })?.timeSeconds).toBe(2700);
    expect(calculateDevTime({ ...base, shotIso: 200 })?.timeSeconds).toBe(450);
  });
  it("extrapolates beyond +3 stops", () => {
    expect(calculateDevTime({ ...base, shotIso: 6400 })?.timeSeconds).toBe(4050);
  });
  it("picks the push curve by developer and film", () => {
    expect(bwPushCurve("kodak-d-76-ilford-id-11", "kodak-tri-x-400").curve).toBe(PUSH_CURVES.bwStandard);
    expect(bwPushCurve("ilford-dd-x", "ilford-hp5-plus").curve).toBe(PUSH_CURVES.bwCompensating);
    expect(bwPushCurve("kodak-d-76-ilford-id-11", "kodak-t-max-400").curve).toBe(PUSH_CURVES.bwTmax);
  });
  it("matches the T-Max film factors", () => {
    const c = PUSH_CURVES.bwTmax;
    expect([curveValue(c, 1), curveValue(c, 2), curveValue(c, 3)]).toEqual([1, 1.33, 1.66]);
  });
  it("refuses to push where not advised but allows a pull", () => {
    const push = calculateDevTime({ ...base, filmStockId: "fp", developerId: "perc", shotIso: 128 })!;
    expect(push.timeSeconds).toBe(420);
    expect(push.notes).toHaveLength(1);
    expect(calculateDevTime({ ...base, filmStockId: "fp", developerId: "perc", shotIso: 32 })?.timeSeconds).toBe(315);
  });
  it("matches any-film recipes and ignores ISO", () => {
    const r = calculateDevTime({ ...base, filmStockId: "anything", developerId: "stand", dilution: "1+100", shotIso: 800 })!;
    expect(r.timeSeconds).toBe(3600);
    expect(r.stops).toBe(0);
  });
  it("compensates temperature", () => {
    expect(calculateDevTime({ ...base, shotIso: 400, tempC: 18, tempChart: BW_TEMP_CHART })?.timeSeconds).toBe(720);
    expect(calculateDevTime({ ...base, shotIso: 400, tempC: 22, tempChart: BW_TEMP_CHART })?.timeSeconds).toBe(504);
  });
  it("interpolates and clamps the chart and curve", () => {
    expect(tempFactor(BW_TEMP_CHART, 20.5)).toBeCloseTo(0.955);
    expect(tempFactor(BW_TEMP_CHART, 10)).toBe(1.2);
    expect(curveValue(PUSH_CURVES.bwStandard, 0.5)).toBeCloseTo(1.25);
  });
  it("filters remjet and sets the develop step", () => {
    const steps = [
      { order: 1, name: "Remjet removal", timeSeconds: 60, instructions: "", onlyIfRemjet: true },
      { order: 2, name: "Developer", timeSeconds: 0, instructions: "", isDevelop: true },
    ];
    expect(buildSteps(steps, false, 500)).toHaveLength(1);
    expect(buildSteps(steps, true, 500)[1].timeSeconds).toBe(500);
  });
  it("formats and counts stops", () => {
    expect(formatDuration(545)).toBe("9:05");
    expect(formatDuration(3600)).toBe("1:00:00");
    expect(stopsFromBox(400, 1600)).toBe(2);
  });
});

describe("workbook data", () => {
  it("has the expected D-76 Tri-X time", () => {
    const r = BW_RECIPES.find((x) => x.filmStockId === "kodak-tri-x-400" && x.developerId.startsWith("kodak-d-76") && x.dilution === "Stock")!;
    expect(r.timeSeconds).toBe(405);
  });
  it("matches the workbook's C-41 push times", () => {
    const kit = COLOR_KITS.find((k) => k.id.includes("unicolor"))!;
    expect(calculateKitTime({ kit, boxIso: 400, shotIso: 800, pushCurve: PUSH_CURVES.c41, rollsDeveloped: 0 })?.developSeconds).toBe(273); // 4:33
    expect(calculateKitTime({ kit, boxIso: 400, shotIso: 1600, pushCurve: PUSH_CURVES.c41, rollsDeveloped: 0 })?.developSeconds).toBe(357); // 5:57
  });
  it("matches the workbook's E-6 first-developer push times", () => {
    const kit = COLOR_KITS.find((k) => k.process === "E-6" && k.name.startsWith("Home"))!;
    expect(calculateKitTime({ kit, boxIso: 100, shotIso: 200, pushCurve: PUSH_CURVES.e6, rollsDeveloped: 0 })?.developSeconds).toBe(495); // 8:15
    expect(calculateKitTime({ kit, boxIso: 100, shotIso: 400, pushCurve: PUSH_CURVES.e6, rollsDeveloped: 0 })?.developSeconds).toBe(675); // 11:15
  });
  it("adds reuse time for home kits", () => {
    const kit = COLOR_KITS.find((k) => k.id.includes("unicolor"))!;
    expect(calculateKitTime({ kit, boxIso: 400, shotIso: 400, pushCurve: PUSH_CURVES.c41, rollsDeveloped: 5 })?.developSeconds).toBe(231);
  });
});

describe("pushLabel", () => {
  it("describes the push or pull from box speed in thirds", () => {
    expect(pushLabel(400, 400)).toBe("Box speed: develop normally.");
    expect(pushLabel(400, 1600)).toBe("+2 stops: push this roll in development.");
    expect(pushLabel(400, 800)).toBe("+1 stop: push this roll in development.");
    expect(pushLabel(400, 200)).toBe("−1 stop: pull this roll in development.");
    expect(pushLabel(400, 500)).toBe("+⅓ stop: push this roll in development.");
    expect(pushLabel(100, 250)).toBe("+1⅓ stops: push this roll in development.");
  });
});
