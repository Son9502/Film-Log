// ── Expired film: extra exposure for age ─────────────────────────────────────
// The rule of thumb is about one stop of extra exposure per decade past the expiry
// date: rate the film slower when shooting, then develop it as if shot at box speed.
// It's a community guideline, not datasheet data, so the app only suggests a value
// and the photographer decides.
import type { DevProcess } from "@/types";
import { developmentStops, stopsText } from "./devCalc";

export type FilmStorage = "frozen" | "fridge" | "room" | "hot";

export const STORAGE_OPTIONS: { id: FilmStorage; label: string }[] = [
  { id: "frozen", label: "Frozen" },
  { id: "fridge", label: "Fridge" },
  { id: "room", label: "Room temp" },
  { id: "hot", label: "Hot / unknown" },
];

/** How fast film ages in storage, relative to room temperature. */
const STORAGE_RATE: Record<FilmStorage, number> = { frozen: 0.25, fridge: 0.5, room: 1, hot: 1.5 };

/** Never suggest more than this; heavily expired film needs bracketing, not a formula. */
export const MAX_SUGGESTED_STOPS = 3;
/** Largest compensation the stepper allows. */
export const MAX_COMP_STOPS = 5;

const DATE_RE = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/;

/** Years (fractional) since the expiry date; 0 if not expired or the date is unreadable. */
export function yearsPastExpiry(expiresAt: string | undefined, today: string): number {
  const e = expiresAt ? DATE_RE.exec(expiresAt.trim()) : null;
  const t = DATE_RE.exec(today);
  if (!e || !t) return 0;
  // A month-only date ("2014-06") expires at the end of that month.
  const exp = e[3] ? Date.UTC(+e[1], +e[2] - 1, +e[3]) : Date.UTC(+e[1], +e[2], 0);
  const now = Date.UTC(+t[1], +t[2] - 1, +(t[3] ?? 1));
  const days = (now - exp) / 86_400_000;
  return days > 0 ? days / 365.25 : 0;
}

export const isValidExpiry = (v: string) => DATE_RE.test(v.trim());

/** Rounds to the nearest third of a stop, stored to two decimals (1.33, 0.67) so it syncs exactly. */
export function roundCompStops(stops: number): number {
  const thirds = Math.round(stops * 3);
  return Math.round((thirds / 3) * 100) / 100;
}

// Standard ISO scale in thirds of a stop.
const ISO_SCALE = [
  3, 4, 5, 6, 8, 10, 12, 16, 20, 25, 32, 40, 50, 64, 80, 100, 125, 160, 200, 250, 320, 400,
  500, 640, 800, 1000, 1250, 1600, 2000, 2500, 3200, 4000, 5000, 6400, 8000, 10000, 12800,
];

/** Nearest ISO on the standard scale (by stops, not by number). */
export function nearestStandardIso(iso: number): number {
  if (!(iso > 0)) return iso;
  return ISO_SCALE.reduce((best, n) =>
    Math.abs(Math.log2(n / iso)) < Math.abs(Math.log2(best / iso)) ? n : best);
}

/** The ISO to set on the meter after shifting `iso` by `stops` of extra exposure. */
export function rateSlower(iso: number, stops: number): number {
  return nearestStandardIso(iso / 2 ** stops);
}

export interface ExpiryAdvice {
  years: number;
  /** Suggested extra exposure, in thirds of a stop. */
  stops: number;
  /** The box speed shifted by `stops`, on the standard scale. */
  ratedIso: number | null;
  notes: string[];
}

/** Suggested extra exposure for film past its expiry date, or null if it isn't expired. */
export function expiryAdvice(input: {
  expiresAt: string | undefined;
  today: string;
  boxIso: number | undefined;
  process?: DevProcess | null;
  storage?: FilmStorage;
}): ExpiryAdvice | null {
  const years = yearsPastExpiry(input.expiresAt, input.today);
  if (years <= 0) return null;
  const storage = input.storage ?? "room";
  const box = input.boxIso ?? 0;
  const notes: string[] = [];

  let rate = STORAGE_RATE[storage]; // stops per decade
  if (box >= 800) {
    rate *= 1.5;
    notes.push("Fast film fogs faster with age.");
  } else if (box > 0 && box <= 100) {
    rate *= 0.75;
  }
  if (input.process === "E-6") {
    rate *= 0.5;
    notes.push("Slide film has little latitude: bracket if you can.");
  }

  let stops = roundCompStops((years / 10) * rate);
  if (stops > MAX_SUGGESTED_STOPS) {
    stops = MAX_SUGGESTED_STOPS;
    notes.push(`Very old film: capped at ${stopsText(MAX_SUGGESTED_STOPS)}. Bracket and expect fog and colour shifts.`);
  }
  if (stops > 0) notes.push("Develop as if shot at box speed.");

  return { years, stops, ratedIso: box > 0 ? rateSlower(box, stops) : null, notes };
}

/** "6 months", "1 year", "12 years". */
export function formatAge(years: number): string {
  if (years < 1) {
    const months = Math.max(1, Math.round(years * 12));
    return `${months} month${months === 1 ? "" : "s"}`;
  }
  const y = Math.round(years);
  return `${y} year${y === 1 ? "" : "s"}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Jun 30, 2014" for a full date, "Jun 2014" for a month-only date. */
export function formatExpiry(expiresAt: string): string {
  const m = DATE_RE.exec(expiresAt.trim());
  if (!m) return expiresAt;
  const month = MONTHS[+m[2] - 1] ?? m[2];
  return m[3] ? `${month} ${+m[3]}, ${m[1]}` : `${month} ${m[1]}`;
}

/**
 * The roll card's note on how the film was rated, e.g. " · rated from 400 (push)" or
 * " · rated from 400: +1 stop for age, develop at box speed". Empty at box speed.
 */
export function ratingSummary(roll: { iso: string; expiryCompStops?: number }, boxIso: number | undefined): string {
  const shot = parseInt(roll.iso, 10);
  if (!boxIso || !(shot > 0)) return "";
  const comp = roll.expiryCompStops ?? 0;
  const dev = developmentStops(boxIso, shot, comp);
  const pushes = Math.round(dev * 3) !== 0;
  if (!comp) return shot !== boxIso ? ` · rated from ${boxIso} (${dev > 0 ? "push" : "pull"})` : "";
  const develop = pushes ? `${stopsText(dev)} ${dev > 0 ? "push" : "pull"}` : "develop at box speed";
  return ` · rated from ${boxIso}: ${stopsText(comp)} for age, ${develop}`;
}
