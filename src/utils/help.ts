// ── Help text ────────────────────────────────────────────────────────────────
// Shared by the inline "?" hints and the Help & Feedback screen, so they never
// disagree. Keep each answer short and in the app's own button names.

/** Where "Send feedback" goes. Swap for a form or a mailto: link if you prefer. */
export const FEEDBACK_URL = "https://github.com/Son9502/Film-Log/issues/new";

export const HELP = {
  statuses:
    "Shooting → To Develop (finished, waiting) → In Development (you're developing it) or In Lab (a lab has it) → In Scanning (developed, waiting for scans) → Archived (scanned and done). The buttons only offer the next valid step.",
  pushPull:
    "Pushing means shooting film at a higher ISO than the box says (400 film at 800) and developing it longer to make up for it. Pulling is the reverse. Each doubling of ISO is one stop. Film Log works it out from the box speed and the ISO you shot at.",
  expired:
    "Old film loses sensitivity, so it's usually given extra exposure: about a stop per decade past expiry, less if it was kept cold, more for fast film. It's then developed as normal (box speed), not pulled, because the extra exposure only makes up for its age.",
  batches:
    "A batch shares one tank, so every roll needs the same process (all C-41, for example), the same remjet handling, and development times within 5% of each other. Rolls whose film has no recipe can't be timed.",
  scanMatching:
    "Scans are matched to frames by the number in the file name (scan_07.jpg goes to frame 7). From Photos, the order you tapped is kept. You can change any match before uploading, and frames you didn't log are created for extra scans.",
  uploads:
    "Each file must be a real JPEG, PNG, TIFF or HEIC, up to 50 MB (ZIPs up to 500 MB). A network problem is retried once automatically, and anything that still fails can be retried from the import screen. Keep the app open while it uploads.",
  privacy:
    "Your rolls, frames and scans are private: only your account can read them, and scans open through links that expire after an hour. Sharing is off for now. Exported JPEGs include each frame's details, GPS too, so check before passing those files on.",
  offline:
    "Yes. Everything you log is saved on the device first and syncs when you're back online. If the same detail was changed differently on two devices, Settings → Sync asks which to keep.",
  backup:
    "Settings → Export Data saves a spreadsheet of every roll and frame, and Export Scans saves the original scans with their details. Open both files to check them before deleting anything from your phone or computer.",
} as const;

export const FAQ: { q: string; a: string }[] = [
  { q: "How do roll statuses work?", a: HELP.statuses },
  { q: "What do push and pull mean?", a: HELP.pushPull },
  { q: "How does expired film work?", a: HELP.expired },
  { q: "Why won't a batch take some rolls?", a: HELP.batches },
  { q: "How are scans matched to frames?", a: HELP.scanMatching },
  { q: "Why did a scan fail to upload?", a: HELP.uploads },
  { q: "Is my data private?", a: HELP.privacy },
  { q: "Does it work offline?", a: HELP.offline },
  { q: "How do I back everything up?", a: HELP.backup },
];
