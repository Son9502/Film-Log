import { Camera, FilmStock } from "@/types";

// ── Theme ────────────────────────────────────────────────────────────────────
export const COLORS = {
  bg: "#101820",
  bgCard: "#19242d",
  bgElevated: "#24333e",
  border: "#52616b",
  borderSubtle: "#364651",

  amber: "#b8860b",
  amberLight: "#d4a017",
  amberDim: "#7a5a08",

  textPrimary: "#f0e6d0",
  textSecondary: "#e8dcc8",
  textMuted: "#c0cbd0",
  textDim: "#adbac1",

  danger: "#8b3030",
  success: "#4a8a4a",
  info: "#4a4a8a",
};

export const FONTS = {
  mono: "Courier New",
};

// ── Default Gear ─────────────────────────────────────────────────────────────
export const DEFAULT_CAMERAS: Camera[] = [
  { id: "nikon-fe", name: "Nikon FE", isCustom: false },
  { id: "nikon-l35ad2", name: "Nikon L35AD2", isCustom: false },
  { id: "other", name: "Other", isCustom: false },
];

export const DEFAULT_FILM_STOCKS: FilmStock[] = [
  { id: "portra-160", name: "Kodak Portra 160", iso: 160, isCustom: false, process: "C-41" },
  { id: "portra-400", name: "Kodak Portra 400", iso: 400, isCustom: false, process: "C-41" },
  { id: "portra-800", name: "Kodak Portra 800", iso: 800, isCustom: false, process: "C-41" },
  { id: "gold-200", name: "Kodak Gold 200", iso: 200, isCustom: false, process: "C-41" },
  { id: "colorplus-200", name: "Kodak ColorPlus 200", iso: 200, isCustom: false, process: "C-41" },
  { id: "ektar-100", name: "Kodak Ektar 100", iso: 100, isCustom: false, process: "C-41" },
  { id: "ultramax-400", name: "Kodak UltraMax 400", iso: 400, isCustom: false, process: "C-41" },
  { id: "fuji-superia-400", name: "Fuji Superia 400", iso: 400, isCustom: false, process: "C-41" },
  { id: "fuji-pro-400h", name: "Fuji Pro 400H", iso: 400, isCustom: false, process: "C-41" },
  { id: "velvia-50", name: "Fuji Velvia 50", iso: 50, isCustom: false, process: "E-6" },
  { id: "provia-100f", name: "Fuji Provia 100F", iso: 100, isCustom: false, process: "E-6" },
  { id: "hp5-plus", name: "Ilford HP5 Plus", iso: 400, isCustom: false, process: "B&W" },
  { id: "delta-100", name: "Ilford Delta 100", iso: 100, isCustom: false, process: "B&W" },
  { id: "delta-3200", name: "Ilford Delta 3200", iso: 3200, isCustom: false, process: "B&W" },
  { id: "fp4-plus", name: "Ilford FP4 Plus", iso: 125, isCustom: false, process: "B&W" },
  { id: "trix-400", name: "Kodak Tri-X 400", iso: 400, isCustom: false, process: "B&W" },
  { id: "rpx-400", name: "Rollei RPX 400", iso: 400, isCustom: false, process: "B&W" },
];

export const LIGHTING_CONDITIONS = [
  "Bright Sun",
  "Overcast",
  "Open Shade",
  "Indoor Natural",
  "Indoor Artificial",
  "Mixed",
  "Golden Hour",
  "Blue Hour",
  "Night",
];

export const FILTER_OPTIONS = [
  "UV", "Polarizer", "ND2", "ND4", "ND8", "ND16", "Red", "Orange", "Yellow", "Green",
];

export const WEATHER_CONDITIONS = [
  "Sunny", "Partly Cloudy", "Overcast", "Rainy", "Foggy", "Snowy", "Indoor",
];

export const ROLL_STATUS_LIST = [
  "Shooting",
  "To Develop",
  "In Development",
  "In Lab",
  "In Scanning",
  "Archived",
] as const;

// Where a roll can go next. "To Develop" is the buffer between finishing a roll and
// developing it. In Lab covers lab development, lab scanning, or both, so it can go to
// In Scanning (you scan it) or straight to Archived (the lab scanned it).
export const NEXT_STATUSES: Record<(typeof ROLL_STATUS_LIST)[number], (typeof ROLL_STATUS_LIST)[number][]> = {
  Shooting: ["To Develop"],
  "To Develop": ["In Development", "In Lab"],
  "In Development": ["In Scanning", "In Lab"],
  "In Lab": ["In Scanning", "Archived"],
  "In Scanning": ["Archived"],
  Archived: [],
};

export function statusActionLabel(from: string, to: string): string {
  if (from === "Shooting" && to === "To Develop") return "Finish roll";
  if (from === "To Develop" && to === "In Development") return "Develop myself";
  if (from === "To Develop" && to === "In Lab") return "Send to lab";
  if (from === "In Development" && to === "In Scanning") return "Scan myself";
  if (from === "In Development" && to === "In Lab") return "Send to lab to scan";
  if (from === "In Lab" && to === "In Scanning") return "Back from lab — I'll scan";
  if (from === "In Lab" && to === "Archived") return "Lab scanned — archive";
  if (to === "Archived") return "Archive";
  return to;
}

// Maps statuses from before the inventory update onto the new flow.
export function normalizeStatus(status: string): (typeof ROLL_STATUS_LIST)[number] {
  if (status === "At Lab") return "In Lab";
  if (status === "Developed") return "In Scanning";
  if (status === "Stock") return "Shooting";
  return (ROLL_STATUS_LIST as readonly string[]).includes(status)
    ? (status as (typeof ROLL_STATUS_LIST)[number])
    : "Shooting";
}

export const FRAME_COUNT_OPTIONS = [12, 24, 36];

export const MAX_STARS = 5;

export const WALK_DIFFICULTIES = ["Easy", "Moderate", "Challenging"] as const;
export type WalkDifficulty = (typeof WALK_DIFFICULTIES)[number];

export const WALK_TAG_OPTIONS = [
  "Street", "Architecture", "Nature", "Portrait", "Night", "Golden Hour",
  "Mural", "Industrial", "Vintage", "Minimal", "Urban", "Coastal",
];

export interface BadgeDef {
  id: string;
  name: string;
  description: string;
  emoji: string;
  check: (s: {
    // volume
    rollCount: number;
    frameCount: number;
    stockCount: number;
    cameraCount: number;
    locationCount: number;
    finishedRolls: number;     // rolls where shots.length >= frameCount
    // development
    developedRolls: number;
    pushedRolls: number;       // rolls with pushPull starting "+"
    photoFloRolls: number;     // rolls with photoFlo === true
    // craft
    allManualCount: number;    // frames with shutter + aperture + lighting all set
    nightShotCount: number;    // frames with lighting === "Night"
    goldenHourCount: number;   // frames with lighting === "Golden Hour"
    filterTypesUsed: number;   // count of unique filter values used
    weatherTypesUsed: number;  // count of unique weather values used
    // scans
    scannedFrames: number;
    fullStripRolls: number;    // rolls where every frame has a scan
    // ratings & tags
    ratedFrames: number;
    taggedFrames: number;
    topRatedCount: number;     // frames with rating === 5
    curatedRolls: number;      // rolls where every frame has a rating
    uniqueTagCount: number;    // distinct tags across all frames
    quickLogCount: number;
    // walks
    completedWalks: number;
    walksCreatedWithTenCompletions: number;
    walksRated: number;
  }) => boolean;
}

// v1 is a personal film log. Walks, public profiles and their badges are built but hidden
// until v2; flip this to bring them back.
export const SOCIAL_ENABLED = false;

const WALK_BADGE_IDS = ["first_walk", "walker", "trail_blazer", "walk_critic"];

const ALL_BADGES: BadgeDef[] = [
  // ── First steps ────────────────────────────────────────────────────────────
  {
    id: "first_frame",
    name: "First Frame",
    emoji: "📸",
    description: "Log your very first frame.",
    check: (s) => s.frameCount >= 1,
  },
  {
    id: "full_roll",
    name: "Full Roll",
    emoji: "🎞",
    description: "Log a complete roll of film.",
    check: (s) => s.rollCount >= 1,
  },
  {
    id: "finished_roll",
    name: "All the Way",
    emoji: "✅",
    description: "Fill every frame on a roll.",
    check: (s) => s.finishedRolls >= 1,
  },

  // ── Volume milestones ──────────────────────────────────────────────────────
  {
    id: "ten_rolls",
    name: "Ten Rolls",
    emoji: "📦",
    description: "Log 10 rolls.",
    check: (s) => s.rollCount >= 10,
  },
  {
    id: "fifty_rolls",
    name: "Fifty Rolls",
    emoji: "🗂",
    description: "Log 50 rolls.",
    check: (s) => s.rollCount >= 50,
  },
  {
    id: "century",
    name: "Century",
    emoji: "💯",
    description: "Log 100 frames.",
    check: (s) => s.frameCount >= 100,
  },
  {
    id: "five_hundred",
    name: "Five Hundred",
    emoji: "🏆",
    description: "Log 500 frames.",
    check: (s) => s.frameCount >= 500,
  },
  {
    id: "one_thousand",
    name: "One Thousand",
    emoji: "🏅",
    description: "Log 1,000 frames.",
    check: (s) => s.frameCount >= 1000,
  },

  // ── Gear & exploration ─────────────────────────────────────────────────────
  {
    id: "collector",
    name: "Collector",
    emoji: "🧪",
    description: "Try 5 different film stocks.",
    check: (s) => s.stockCount >= 5,
  },
  {
    id: "multi_cam",
    name: "Multi-Cam",
    emoji: "📷",
    description: "Shoot with 3 or more different cameras.",
    check: (s) => s.cameraCount >= 3,
  },
  {
    id: "wanderer",
    name: "Wanderer",
    emoji: "🌍",
    description: "Shoot in 5 different locations.",
    check: (s) => s.locationCount >= 5,
  },
  {
    id: "explorer",
    name: "Explorer",
    emoji: "🗺",
    description: "Shoot in 15 or more different locations.",
    check: (s) => s.locationCount >= 15,
  },

  // ── Craft & technique ──────────────────────────────────────────────────────
  {
    id: "full_manual",
    name: "Full Manual",
    emoji: "🎛",
    description: "Log a frame with shutter, aperture, and lighting all recorded.",
    check: (s) => s.allManualCount >= 1,
  },
  {
    id: "night_owl",
    name: "Night Owl",
    emoji: "🌙",
    description: "Log a frame in Night lighting.",
    check: (s) => s.nightShotCount >= 1,
  },
  {
    id: "golden_hour",
    name: "Golden Hour",
    emoji: "🌅",
    description: "Log a frame at golden hour.",
    check: (s) => s.goldenHourCount >= 1,
  },
  {
    id: "full_spectrum",
    name: "Full Spectrum",
    emoji: "🌈",
    description: "Use all 10 filter types across your frames.",
    check: (s) => s.filterTypesUsed >= 10,
  },
  {
    id: "weathered",
    name: "Weathered",
    emoji: "☁️",
    description: "Shoot in 5 different weather conditions.",
    check: (s) => s.weatherTypesUsed >= 5,
  },

  // ── Darkroom ────────────────────────────────────────────────────────────────
  {
    id: "darkroom",
    name: "Darkroom",
    emoji: "🧫",
    description: "Develop a roll yourself.",
    check: (s) => s.developedRolls >= 1,
  },
  {
    id: "push_it",
    name: "Push It",
    emoji: "🔬",
    description: "Push-process a roll by at least one stop.",
    check: (s) => s.pushedRolls >= 1,
  },
  {
    id: "photo_flo",
    name: "Photo-Flo",
    emoji: "🧴",
    description: "Use Photo-Flo in your final rinse.",
    check: (s) => s.photoFloRolls >= 1,
  },
  {
    id: "lab_rat",
    name: "Lab Rat",
    emoji: "🏭",
    description: "Develop 5 rolls yourself.",
    check: (s) => s.developedRolls >= 5,
  },

  // ── Scanning & archiving ───────────────────────────────────────────────────
  {
    id: "first_scan",
    name: "First Scan",
    emoji: "🖼",
    description: "Attach a scan to any frame.",
    check: (s) => s.scannedFrames >= 1,
  },
  {
    id: "full_strip",
    name: "Full Strip",
    emoji: "📽",
    description: "Scan every frame on a complete roll.",
    check: (s) => s.fullStripRolls >= 1,
  },

  // ── Ratings & tags ─────────────────────────────────────────────────────────
  {
    id: "critic",
    name: "Critic",
    emoji: "⭐",
    description: "Rate 10 frames.",
    check: (s) => s.ratedFrames >= 10,
  },
  {
    id: "perfectionist",
    name: "Perfectionist",
    emoji: "🌟",
    description: "Give 5 frames a 5-star rating.",
    check: (s) => s.topRatedCount >= 5,
  },
  {
    id: "curator",
    name: "Curator",
    emoji: "🎖",
    description: "Rate every frame on a complete roll.",
    check: (s) => s.curatedRolls >= 1,
  },
  {
    id: "tagger",
    name: "Tagger",
    emoji: "🏷",
    description: "Tag 20 frames.",
    check: (s) => s.taggedFrames >= 20,
  },
  {
    id: "label_maker",
    name: "Label Maker",
    emoji: "🔖",
    description: "Use 10 unique tags across your frames.",
    check: (s) => s.uniqueTagCount >= 10,
  },

  // ── Photo walks ────────────────────────────────────────────────────────────
  {
    id: "first_walk",
    name: "First Walk",
    emoji: "🚶",
    description: "Complete your first photo walk.",
    check: (s) => s.completedWalks >= 1,
  },
  {
    id: "walker",
    name: "Walker",
    emoji: "👟",
    description: "Complete 5 photo walks.",
    check: (s) => s.completedWalks >= 5,
  },
  {
    id: "trail_blazer",
    name: "Trail Blazer",
    emoji: "✍️",
    description: "Create a walk that earns 10 or more completions.",
    check: (s) => s.walksCreatedWithTenCompletions >= 1,
  },
  {
    id: "walk_critic",
    name: "Walk Critic",
    emoji: "🗣",
    description: "Rate 5 photo walks.",
    check: (s) => s.walksRated >= 5,
  },
];

export const BADGES: BadgeDef[] = SOCIAL_ENABLED
  ? ALL_BADGES
  : ALL_BADGES.filter((b) => !WALK_BADGE_IDS.includes(b.id));
