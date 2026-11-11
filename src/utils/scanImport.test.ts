import { assignScanFrames, identifyScanFiles, planMissingScanFrames } from "./scanImport";

describe("identifyScanFiles", () => {
  it("keeps duplicate filenames distinct for assignment and frame creation", () => {
    const files = identifyScanFiles([{ name: "scan.jpg" }, { name: "scan.jpg" }]);
    expect(files.map((file) => file.id)).toEqual(["0", "1"]);
    const assigned = assignScanFrames(files, [1]);
    expect(assigned).toEqual({ "0": 1, "1": null });
    const plan = planMissingScanFrames(files.map((file) => file.id), [1], assigned);
    expect(plan).toEqual({ frames: [2], assignments: { "0": 1, "1": 2 } });
  });
});

describe("planMissingScanFrames", () => {
  it("creates and assigns 37 frames for 38 photos and one logged frame", () => {
    const files = Array.from({ length: 38 }, (_, index) => `photo-${index + 1}`);
    const assignments = Object.fromEntries(files.map((file, index) => [file, index === 0 ? 1 : null]));
    const plan = planMissingScanFrames(files, [1], assignments);
    expect(plan.frames).toEqual(Array.from({ length: 37 }, (_, index) => index + 2));
    expect(Object.values(plan.assignments)).toEqual(Array.from({ length: 38 }, (_, index) => index + 1));
  });

  it("handles no logged frames and preserves existing custom assignments", () => {
    expect(planMissingScanFrames(["a", "b"], [], { a: null, b: null })).toEqual({
      frames: [1, 2], assignments: { a: 1, b: 2 },
    });
    expect(planMissingScanFrames(["a", "b", "c"], [1, 4], { a: 4, b: null, c: 1 })).toEqual({
      frames: [5], assignments: { a: 4, b: 5, c: 1 },
    });
  });

  it("does not create frames when enough are already logged", () => {
    expect(planMissingScanFrames(["a"], [1, 2], { a: 2 })).toEqual({
      frames: [], assignments: { a: 2 },
    });
  });
});
