import { backOrReplace } from "./navigation";

describe("backOrReplace", () => {
  it("goes back when the navigator has history", () => {
    const router = { canGoBack: () => true, back: jest.fn(), replace: jest.fn() };
    backOrReplace(router, "/(tabs)");
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("opens the fallback when the screen has no history", () => {
    const router = { canGoBack: () => false, back: jest.fn(), replace: jest.fn() };
    const roll = { pathname: "/roll/[id]" as const, params: { id: "roll-1" } };
    backOrReplace(router, roll);
    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith(roll);
  });
});
