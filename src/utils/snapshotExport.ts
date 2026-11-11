import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFilmLogStore } from "@/store";
import { saveJsonFile } from "./exportFiles";
import { createLocalSnapshot } from "./localSnapshot";

export async function exportCurrentLocalSnapshot(): Promise<void> {
  const state = useFilmLogStore.getState();
  if (!state.hydrated) throw new Error("Local data is still loading. Try again shortly.");
  const storedUserId = await AsyncStorage.getItem("filmlog:userId");
  const current = useFilmLogStore.getState();
  if (state.user?.id !== current.user?.id) throw new Error("Account changed during export. Try again.");
  const now = new Date();
  const snapshot = createLocalSnapshot(current, current.user?.id ?? storedUserId, now.toISOString());
  const filename = `filmlog-local-${now.toISOString().replace(/[:.]/g, "-")}.json`;
  await saveJsonFile(filename, JSON.stringify(snapshot, null, 2));
}
