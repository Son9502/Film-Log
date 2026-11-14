import type { Href, useRouter } from "expo-router";

type Router = Pick<ReturnType<typeof useRouter>, "canGoBack" | "back" | "replace">;

export function backOrReplace(router: Router, fallback: Href): void {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
