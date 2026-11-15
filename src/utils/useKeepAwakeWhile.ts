// Keeps the screen on while `active` is true, so a long scan upload isn't stopped
// by the phone locking. The screen can sleep again as soon as it's false.
import { useEffect } from "react";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";

export function useKeepAwakeWhile(active: boolean, tag: string): void {
  useEffect(() => {
    if (!active) return;
    // Not every browser supports keeping the screen on; uploads still work without it.
    activateKeepAwakeAsync(tag).catch(() => {});
    return () => {
      deactivateKeepAwake(tag).catch(() => {});
    };
  }, [active, tag]);
}
