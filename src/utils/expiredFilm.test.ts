import {
  expiryAdvice, formatAge, formatExpiry, nearestStandardIso, rateSlower, ratingSummary,
  roundCompStops, yearsPastExpiry,
} from "./expiredFilm";
import { developmentStops, pushLabel, stopsText } from "./devCalc";
import { dbToRoll, rollSyncFields, rollToDb } from "./rollRows";
import { todayISO } from "./index";
import type { Roll } from "@/types";

const today = "2026-11-13";

describe("yearsPastExpiry", () => {
  it("is zero for film that hasn't expired or has no date", () => {
    expect(yearsPastExpiry("2027-01-01", today)).toBe(0);
    expect(yearsPastExpiry(undefined, today)).toBe(0);
    expect(yearsPastExpiry("not a date", today)).toBe(0);
  });
  it("counts years since expiry", () => {
    expect(yearsPastExpiry("2016-11-13", today)).toBeCloseTo(10, 1);
  });
  it("reads a month-only date as the end of that month", () => {
    expect(yearsPastExpiry("2026-11", today)).toBe(0);
    expect(yearsPastExpiry("2016-10", today)).toBeCloseTo(10.04, 1);
  });
});

describe("expiryAdvice", () => {
  const base = { today, boxIso: 400, process: "C-41" as const };

  it("returns null for film in date", () => {
    expect(expiryAdvice({ ...base, expiresAt: "2027-06-30" })).toBeNull();
  });
  it("suggests about a stop per decade at room temperature", () => {
    const a = expiryAdvice({ ...base, expiresAt: "2016-11-13" })!;
    expect(a.stops).toBe(1);
    expect(a.ratedIso).toBe(200);
    expect(a.notes.join(" ")).toMatch(/box speed/);
  });
  it("suggests nothing for film a year out of date", () => {
    expect(expiryAdvice({ ...base, expiresAt: "2025-11-13" })!.stops).toBe(0);
  });
  it("suggests less for cold storage and more for fast film", () => {
    expect(expiryAdvice({ ...base, expiresAt: "2016-11-13", storage: "frozen" })!.stops).toBe(0.33);
    expect(expiryAdvice({ ...base, expiresAt: "2006-11-13", storage: "fridge" })!.stops).toBe(1);
    const fast = expiryAdvice({ ...base, boxIso: 1600, expiresAt: "2012-11-13" })!;
    expect(fast.stops).toBe(2); // 14 years × 1.5
    expect(fast.notes.join(" ")).toMatch(/Fast film/);
  });
  it("is gentler on slide film and warns about latitude", () => {
    const a = expiryAdvice({ ...base, process: "E-6", boxIso: 100, expiresAt: "2006-11-13" })!;
    expect(a.stops).toBe(0.67); // 20 years × 0.75 (slow) × 0.5 (slide) = 0.75 → ⅔
    expect(a.notes.join(" ")).toMatch(/bracket/i);
  });
  it("caps very old film", () => {
    const a = expiryAdvice({ ...base, expiresAt: "1976-01-01", storage: "hot" })!;
    expect(a.stops).toBe(3);
    expect(a.ratedIso).toBe(50);
    expect(a.notes.join(" ")).toMatch(/capped/);
  });
});

describe("ISO helpers", () => {
  it("rounds to the standard scale", () => {
    expect(nearestStandardIso(252)).toBe(250);
    expect(nearestStandardIso(317)).toBe(320);
    expect(rateSlower(400, 1)).toBe(200);
    expect(rateSlower(400, 1 / 3)).toBe(320);
    expect(rateSlower(200, -1 / 3)).toBe(250);
  });
  it("rounds compensation to thirds with two decimals", () => {
    expect(roundCompStops(1.2)).toBe(1.33);
    expect(roundCompStops(0.6)).toBe(0.67);
    expect(roundCompStops(0.1)).toBe(0);
  });
});

describe("developmentStops", () => {
  it("adds the age compensation back", () => {
    expect(developmentStops(400, 200, 1)).toBe(0);
    expect(developmentStops(400, 250, 0.67)).toBe(0);
    expect(developmentStops(400, 400, 1)).toBe(1);
    expect(developmentStops(400, 200)).toBe(-1);
  });
  it("labels expired film as box-speed development", () => {
    expect(pushLabel(400, 200, 1)).toBe("Rated +1 stop for age. Develop as box speed.");
    expect(pushLabel(400, 200)).toMatch(/pull/);
    expect(stopsText(1.33)).toBe("+1⅓ stops");
  });
});

describe("ratingSummary", () => {
  it("describes push, pull and age compensation", () => {
    expect(ratingSummary({ iso: "400" }, 400)).toBe("");
    expect(ratingSummary({ iso: "800" }, 400)).toBe(" · rated from 400 (push)");
    expect(ratingSummary({ iso: "200", expiryCompStops: 1 }, 400)).toBe(" · rated from 400: +1 stop for age, develop at box speed");
    expect(ratingSummary({ iso: "400", expiryCompStops: 1 }, 400)).toBe(" · rated from 400: +1 stop for age, +1 stop push");
  });
});

describe("formatting", () => {
  it("formats expiry dates and ages", () => {
    expect(formatExpiry("2014-06-30")).toBe("Jun 30, 2014");
    expect(formatExpiry("2014-06")).toBe("Jun 2014");
    expect(formatAge(0.4)).toBe("5 months");
    expect(formatAge(12.2)).toBe("12 years");
  });
});

describe("roll sync fields", () => {
  const roll = {
    id: "r", filmStockId: "portra-400", cameraId: "c", iso: "200", frameCount: 36, status: "Shooting",
    loadedAt: "2026-11-13", shots: [], createdAt: "", updatedAt: "",
  } as Roll;

  it("round-trips the expiry fields", () => {
    const withExpiry = { ...roll, expiresAt: "2014-06", expiryCompStops: 1.33 };
    expect(dbToRoll(rollToDb(withExpiry, "u"))).toMatchObject({ expiresAt: "2014-06", expiryCompStops: 1.33 });
  });
  it("treats zero compensation as unset so it doesn't look like a change", () => {
    expect(rollSyncFields({ ...roll, expiryCompStops: 0 })).toEqual(rollSyncFields(roll));
    expect(dbToRoll({ ...rollToDb(roll, "u"), expiry_comp_stops: "1.33" }).expiryCompStops).toBe(1.33);
  });
});

describe("todayISO", () => {
  it("uses the local calendar date", () => {
    expect(todayISO(new Date(2026, 10, 13, 23, 30))).toBe("2026-11-13");
    expect(todayISO(new Date(2026, 0, 5, 0, 5))).toBe("2026-01-05");
  });
});

describe("timestamps from timestamptz columns", () => {
  const { normalizeInstant, normalizeDay, normalizeShotTime } = jest.requireActual("./rollRows");
  it("maps Postgres output back to what the app stored", () => {
    expect(normalizeInstant("2026-11-13T05:22:11.123+00:00")).toBe("2026-11-13T05:22:11.123Z");
    expect(normalizeInstant("2026-11-13 05:22:11.123456+00")).toBe("2026-11-13T05:22:11.123Z");
    expect(normalizeDay("2026-11-13T00:00:00+00:00")).toBe("2026-11-13");
    expect(normalizeDay("2026-03-01T10:00:00+00:00")).toBe("2026-03-01T10:00:00.000Z");
    expect(normalizeShotTime("2026-11-13T14:30:00+00:00")).toBe("2026-11-13 14:30");
  });
  it("leaves values the app wrote unchanged", () => {
    for (const v of ["2026-11-13", "2026-11-13T05:22:11Z", "2026-11-13T05:22:11.123Z", "2026-11-13 14:30", null, undefined]) {
      expect(normalizeInstant(v)).toBe(v);
      expect(normalizeDay(v)).toBe(v);
      expect(normalizeShotTime(v)).toBe(v);
    }
  });
});
