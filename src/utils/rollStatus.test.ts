import { NEXT_STATUSES, ROLL_STATUS_LIST, normalizeStatus, statusActionLabel } from "@/constants";
import type { RollStatus } from "@/types";
import { BATCH_STATUSES, canMoveTo, nextStatusOptions } from "./rollStatus";

type Dropoff = { labScans: boolean } | undefined;

/** Walks a path one move at a time, failing on the first move the rules don't allow. */
function walk(path: RollStatus[], dropoff?: Dropoff) {
  for (let i = 1; i < path.length; i++) {
    const from = path[i - 1];
    const to = path[i];
    // The drop-off only exists once the roll is at the lab.
    const atLab = from === "In Lab" ? dropoff : undefined;
    expect({ move: `${from} → ${to}`, allowed: canMoveTo(from, to, atLab) })
      .toEqual({ move: `${from} → ${to}`, allowed: true });
  }
}

describe("the four paths through the status flow (MVP.md §2)", () => {
  it("develop and scan myself", () => {
    walk(["Shooting", "To Develop", "In Development", "In Scanning", "Archived"]);
  });
  it("lab develops, I scan", () => {
    walk(["Shooting", "To Develop", "In Lab", "In Scanning", "Archived"], { labScans: false });
  });
  it("I develop, lab scans", () => {
    walk(["Shooting", "To Develop", "In Development", "In Lab", "Archived"], { labScans: true });
  });
  it("lab develops and scans", () => {
    walk(["Shooting", "To Develop", "In Lab", "Archived"], { labScans: true });
  });
});

describe("invalid moves are rejected", () => {
  const invalid: [RollStatus, RollStatus][] = [
    ["Shooting", "In Development"], // finish the roll first
    ["Shooting", "In Lab"],
    ["Shooting", "Archived"],
    ["To Develop", "In Scanning"], // only a batch does this, not the status button
    ["To Develop", "Shooting"], // no going back
    ["In Development", "To Develop"],
    ["In Development", "Archived"], // it still needs scanning
    ["In Scanning", "In Lab"],
    ["In Scanning", "In Development"],
  ];
  it.each(invalid)("%s → %s", (from, to) => {
    expect(canMoveTo(from, to)).toBe(false);
  });

  it("nothing moves on from Archived", () => {
    for (const to of ROLL_STATUS_LIST) expect(canMoveTo("Archived", to)).toBe(false);
  });

  it("no status moves to itself", () => {
    for (const s of ROLL_STATUS_LIST) expect(canMoveTo(s, s)).toBe(false);
  });
});

describe("a roll at the lab", () => {
  it("offers only the step that follows once the drop-off is known", () => {
    expect(nextStatusOptions("In Lab", { labScans: true })).toEqual(["Archived"]);
    expect(nextStatusOptions("In Lab", { labScans: false })).toEqual(["In Scanning"]);
    expect(canMoveTo("In Lab", "In Scanning", { labScans: true })).toBe(false);
    expect(canMoveTo("In Lab", "Archived", { labScans: false })).toBe(false);
  });
  it("offers both when there's no drop-off record", () => {
    expect(nextStatusOptions("In Lab")).toEqual(["In Scanning", "Archived"]);
    expect(nextStatusOptions("In Lab", null)).toEqual(["In Scanning", "Archived"]);
  });
  it("ignores a drop-off for rolls that aren't at the lab", () => {
    expect(nextStatusOptions("To Develop", { labScans: true })).toEqual(["In Development", "In Lab"]);
  });
  it("doesn't let callers change the shared rules", () => {
    nextStatusOptions("Shooting").push("Archived");
    expect(NEXT_STATUSES.Shooting).toEqual(["To Develop"]);
  });
});

describe("batches", () => {
  it("take rolls waiting for development or in development", () => {
    expect([...BATCH_STATUSES]).toEqual(["To Develop", "In Development"]);
    expect(BATCH_STATUSES).not.toContain("Shooting");
    expect(BATCH_STATUSES).not.toContain("In Lab");
  });
});

describe("rules are complete", () => {
  it("cover every status", () => {
    expect(Object.keys(NEXT_STATUSES).sort()).toEqual([...ROLL_STATUS_LIST].sort());
  });
  it("only point at real statuses", () => {
    for (const targets of Object.values(NEXT_STATUSES)) {
      for (const t of targets) expect(ROLL_STATUS_LIST).toContain(t);
    }
  });
  it("can reach Archived from every status", () => {
    const reachesArchive = (s: RollStatus, seen = new Set<RollStatus>()): boolean => {
      if (s === "Archived") return true;
      if (seen.has(s)) return false;
      seen.add(s);
      return nextStatusOptions(s).some((n) => reachesArchive(n, seen));
    };
    for (const s of ROLL_STATUS_LIST) expect(reachesArchive(s)).toBe(true);
  });
  it("give every move a button label", () => {
    for (const [from, targets] of Object.entries(NEXT_STATUSES)) {
      for (const to of targets) expect(statusActionLabel(from, to)).not.toBe(to);
    }
  });
});

describe("statuses from before the new flow", () => {
  it("map onto the new statuses", () => {
    expect(normalizeStatus("At Lab")).toBe("In Lab");
    expect(normalizeStatus("Developed")).toBe("In Scanning");
    expect(normalizeStatus("Stock")).toBe("Shooting");
    expect(normalizeStatus("In Scanning")).toBe("In Scanning");
    expect(normalizeStatus("nonsense")).toBe("Shooting");
  });
});
