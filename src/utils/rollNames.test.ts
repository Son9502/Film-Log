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
