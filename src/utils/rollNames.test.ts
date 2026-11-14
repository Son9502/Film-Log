import { hasDuplicateRollName } from "./index";

describe("hasDuplicateRollName", () => {
  const rolls = [{ id: "1", name: " Yosemite Trip " }, { id: "2" }];

  it("matches names regardless of case and surrounding whitespace", () => {
    expect(hasDuplicateRollName(" yosemite trip ", rolls)).toBe(true);
    expect(hasDuplicateRollName("Another trip", rolls)).toBe(false);
  });

  it("ignores empty names and the roll being edited", () => {
    expect(hasDuplicateRollName("  ", rolls)).toBe(false);
    expect(hasDuplicateRollName("Yosemite Trip", rolls, "1")).toBe(false);
    expect(hasDuplicateRollName("Yosemite Trip", [...rolls, { id: "3", name: "YOSEMITE TRIP" }], "1")).toBe(true);
  });
});

describe("pickableCameras", () => {
  const { pickableCameras } = jest.requireActual("./index");
  const cams = [
    { id: "nikon-fe", name: "Nikon FE", isCustom: false },
    { id: "other", name: "Unknown camera", isCustom: false },
    { id: "x1", name: "Pentax K1000", isCustom: true },
  ];
  it("offers your cameras plus built-ins a roll already uses", () => {
    expect(pickableCameras(cams, []).map((c: any) => c.id)).toEqual(["x1"]);
    expect(pickableCameras(cams, [{ cameraId: "nikon-fe" }]).map((c: any) => c.id)).toEqual(["nikon-fe", "x1"]);
    expect(pickableCameras(cams, [], "other").map((c: any) => c.id)).toEqual(["other", "x1"]);
  });
});
