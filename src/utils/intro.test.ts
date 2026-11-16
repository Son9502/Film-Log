import { INTRO_CARDS, introAction, introSeenKey } from "./intro";

describe("introAction", () => {
  it("does nothing once the intro has been seen", () => {
    expect(introAction({ seen: true, rollCount: 0, syncSettled: true })).toBe("none");
  });
  it("skips and remembers for accounts that already have rolls", () => {
    expect(introAction({ seen: false, rollCount: 3, syncSettled: false })).toBe("mark-seen");
  });
  it("waits for the first sync before showing it to an empty account", () => {
    expect(introAction({ seen: false, rollCount: 0, syncSettled: false })).toBe("wait");
  });
  it("shows it to an account with no rolls after sync", () => {
    expect(introAction({ seen: false, rollCount: 0, syncSettled: true })).toBe("show");
  });
});

describe("intro content", () => {
  it("keys the seen flag per account", () => {
    expect(introSeenKey("a")).not.toBe(introSeenKey("b"));
  });
  it("has short, distinct cards", () => {
    expect(new Set(INTRO_CARDS.map((c) => c.title)).size).toBe(INTRO_CARDS.length);
    for (const c of INTRO_CARDS) expect(c.body.length).toBeLessThan(320);
  });
});
