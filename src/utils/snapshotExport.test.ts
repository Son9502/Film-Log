import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFilmLogStore } from "@/store";
import { saveJsonFile } from "./exportFiles";
import { exportCurrentLocalSnapshot } from "./snapshotExport";

jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("./exportFiles", () => ({ saveJsonFile: jest.fn(async () => {}) }));
jest.mock("@/services/supabase", () => ({ supabase: {} }));

describe("exportCurrentLocalSnapshot", () => {
  const data = {
    hydrated: true, user: null, rolls: [], purchases: [], dropoffs: [], chemSets: [], batches: [],
    cameras: [], filmStocks: [], journals: [], personalWalks: [], completions: [], myReviews: [],
    shownProgressNudges: [], temperatureUnit: "C" as const, distanceUnit: "km" as const,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    useFilmLogStore.setState(data);
  });

  it("exports the stored account's local data while signed out", async () => {
    await AsyncStorage.setItem("filmlog:userId", "owner");
    await exportCurrentLocalSnapshot();
    const [filename, contents] = jest.mocked(saveJsonFile).mock.calls[0];
    expect(filename).toMatch(/^filmlog-local-.*\.json$/);
    expect(JSON.parse(contents)).toMatchObject({ format: "film-log-local-snapshot", userId: "owner", data: { rolls: [] } });
  });

  it("marks ownership unknown if no account was recorded", async () => {
    await exportCurrentLocalSnapshot();
    expect(JSON.parse(jest.mocked(saveJsonFile).mock.calls[0][1]).userId).toBeNull();
  });

  it("refuses export while local data is still loading", async () => {
    useFilmLogStore.setState({ hydrated: false });
    await expect(exportCurrentLocalSnapshot()).rejects.toThrow("still loading");
    expect(saveJsonFile).not.toHaveBeenCalled();
  });
});
