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

describe("help content", () => {
  const { FAQ, HELP } = jest.requireActual("./help");
  it("answers every question from the shared help text", () => {
    const answers = new Set(Object.values(HELP));
    for (const item of FAQ) expect(answers.has(item.a)).toBe(true);
    expect(new Set(FAQ.map((f: { q: string }) => f.q)).size).toBe(FAQ.length);
  });
  it("names every status in the status help", () => {
    const { ROLL_STATUS_LIST } = jest.requireActual("@/constants");
    for (const status of ROLL_STATUS_LIST) expect(HELP.statuses).toContain(status);
  });
  it("states the same upload limits the app enforces", () => {
    const { MAX_SCAN_MB, MAX_ZIP_MB } = jest.requireActual("./scanUploadSafety");
    expect(HELP.uploads).toContain(`${MAX_SCAN_MB} MB`);
    expect(HELP.uploads).toContain(`${MAX_ZIP_MB} MB`);
  });
});
