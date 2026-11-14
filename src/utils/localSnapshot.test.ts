import { createLocalSnapshot, LocalSnapshotData } from "./localSnapshot";

describe("createLocalSnapshot", () => {
  const data: LocalSnapshotData = {
    rolls: [{
      id: "roll-1", filmStockId: "film-1", cameraId: "camera-1", iso: "400",
      frameCount: 36, status: "Shooting", loadedAt: "2026-01-01",
      createdAt: "2026-01-01", updatedAt: "2026-01-01",
      shots: [{ id: "shot-1", frame: 1, notes: "private", scanUri: "user-1/roll-1/shot-1.jpg" }],
    }],
    purchases: [], dropoffs: [], chemSets: [], batches: [], cameras: [], filmStocks: [],
    journals: [], personalWalks: [], completions: [], myReviews: [],
    shownProgressNudges: ["milestone"], temperatureUnit: "F", distanceUnit: "mi",
  };

  it("includes the local records and preferences, including unsynced frame data", () => {
    const snapshot = createLocalSnapshot(data, "user-1", "2026-11-09T12:00:00.000Z");
    expect(snapshot).toEqual({
      format: "film-log-local-snapshot",
      version: 1,
      exportedAt: "2026-11-09T12:00:00.000Z",
      userId: "user-1",
      data,
    });
    expect(JSON.parse(JSON.stringify(snapshot)).data.rolls[0].shots[0].notes).toBe("private");
  });

  it("does not export unrelated state or credentials", () => {
    const state = { ...data, accessToken: "secret", user: { email: "private@example.com" } };
    const serialized = JSON.stringify(createLocalSnapshot(state, "user-1", "now"));
    expect(serialized).not.toContain("secret");
    expect(serialized).not.toContain("private@example.com");
  });
});
