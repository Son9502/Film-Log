// ── First-run intro ──────────────────────────────────────────────────────────
// A few cards shown once to a new account. Whether it's been seen is stored per
// account on each device; Settings → Show intro opens it again any time.

export const introSeenKey = (userId: string) => `filmlog:introSeen:${userId}`;

export type IntroAction = "none" | "wait" | "show" | "mark-seen";

/**
 * What to do about the intro for the signed-in user. Someone who already has rolls
 * isn't new, so it's skipped and remembered. With no rolls, wait for the first sync
 * to finish (or fail) before deciding, so an existing account signing in on a new
 * device doesn't see it just because its rolls haven't downloaded yet.
 */
export function introAction(input: { seen: boolean; rollCount: number; syncSettled: boolean }): IntroAction {
  if (input.seen) return "none";
  if (input.rollCount > 0) return "mark-seen";
  if (!input.syncSettled) return "wait";
  return "show";
}

export interface IntroCard {
  icon: string;
  title: string;
  body: string;
}

export const INTRO_CARDS: IntroCard[] = [
  {
    icon: "🎞",
    title: "Welcome to Film Log",
    body: "Film Log follows each roll from the box to the archive: what you shot, how you developed it, and where the scans are. It works on your phone and on the web, and keeps the two in sync.",
  },
  {
    icon: "📷",
    title: "Add your gear",
    body: "Add the cameras you shoot with in Settings → My Gear, or while starting a roll. Common film stocks are already included.\n\nLog film you buy in Film Stash with its expiry date, then load rolls straight from it.",
  },
  {
    icon: "＋",
    title: "Load a roll",
    body: "On the Rolls tab, tap + and pick the film, the camera and the ISO you'll shoot it at.\n\nLoading expired film suggests extra exposure for its age, about a stop per decade.",
  },
  {
    icon: "⚡",
    title: "Log your frames",
    body: "Open the roll while you shoot. Tap ⚡ to log a frame instantly with its location, or + to add shutter speed, aperture, lighting and notes.\n\nYou can fill in the details later.",
  },
  {
    icon: "🧪",
    title: "Develop",
    body: "When the roll is done, tap Finish roll, then choose to develop it yourself or send it to a lab.\n\nOn the Develop tab, track your chemicals, develop a batch of rolls together, and use the calculator for times, push and pull.",
  },
  {
    icon: "🖼",
    title: "Import your scans",
    body: "Once it's developed, tap Import Scans on the roll and pick images from Photos, or images and ZIPs from Files.\n\nScans are matched to frames by file name, and you can change any match before uploading.",
  },
  {
    icon: "✓",
    title: "Keep it safe",
    body: "Settings → Export Data gives you a spreadsheet of every roll and frame, and Export Scans gives you the original files with their details.\n\nYou can see this intro again from Settings.",
  },
];
