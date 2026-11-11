// ── ID generation ─────────────────────────────────────────────────────────────
export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── Date formatting ───────────────────────────────────────────────────────────
export function formatDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Film inventory ────────────────────────────────────────────────────────────
export function isExpired(expiresAt?: string): boolean {
  return !!expiresAt && expiresAt < todayISO();
}

export function rollsRemaining(p: { quantity: number; quantityLoaded: number }): number {
  return Math.max(0, p.quantity - p.quantityLoaded);
}

export function hasDuplicateRollName(
  name: string,
  rolls: { id: string; name?: string }[],
  excludeId?: string,
): boolean {
  const normalized = name.trim().toLowerCase();
  return normalized.length > 0 && rolls.some(
    (roll) => roll.id !== excludeId && roll.name?.trim().toLowerCase() === normalized,
  );
}

// ── Frame validation ──────────────────────────────────────────────────────────
/**
 * Returns an error message if reducing frameCount would orphan existing shots.
 * Returns null if the change is safe.
 */
export function validateFrameCountChange(
  currentShots: number,
  newFrameCount: number
): string | null {
  if (newFrameCount < currentShots) {
    return `This roll has ${currentShots} frames already logged. Reducing to ${newFrameCount} would exceed the frame count. Delete excess frames first, or choose a higher count.`;
  }
  return null;
}

// ── Roll progress ─────────────────────────────────────────────────────────────
export function rollProgress(shotCount: number, frameCount: number): number {
  return Math.min(1, shotCount / Math.max(1, frameCount));
}

// ── Status color map ─────────────────────────────────────────────────────────
export function statusColors(status: string): { bg: string; fg: string } {
  const map: Record<string, { bg: string; fg: string }> = {
    Shooting:         { bg: "#2a1a00", fg: "#b8860b" },
    "To Develop":     { bg: "#2a2410", fg: "#c9a227" },
    "In Development": { bg: "#2a1a1a", fg: "#e68c7c" },
    "In Lab":         { bg: "#1a1a2a", fg: "#a9a9ee" },
    "In Scanning":    { bg: "#2a2a2a", fg: "#aaaaaa" },
    Archived:         { bg: "#1a1a1a", fg: "#aaaaaa" },
  };
  return map[status] ?? { bg: "#1a1a1a", fg: "#aaaaaa" };
}
