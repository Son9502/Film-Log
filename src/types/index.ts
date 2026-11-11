// ── Core domain types for Film Log ──────────────────────────────────────────

export type RollStatus =
  | "Shooting"
  | "To Develop"
  | "In Development"
  | "In Lab"
  | "In Scanning"
  | "Archived";

export interface Camera {
  id: string;
  name: string;        // e.g. "Nikon FE"
  isCustom: boolean;
}

export interface FilmStock {
  id: string;
  name: string;        // e.g. "Kodak Portra 400"
  iso: number;
  isCustom: boolean;
  process?: DevProcess; // how it's developed; unset means "work it out from the name"
}

export interface Location {
  latitude: number;
  longitude: number;
  label?: string;      // Optional human-readable name
}

export interface Shot {
  id: string;
  frame: number;
  shutter?: string;    // e.g. "1/250"
  aperture?: string;   // e.g. "f/2.8"
  lighting?: string;
  subject?: string;
  notes?: string;
  locationLabel?: string; // Manual text location e.g. "Tokyo, Japan"
  location?: Location;    // GPS coordinates (auto-captured)
  scanUri?: string;    // Local URI after scan is attached
  timestamp?: string;  // "YYYY-MM-DD HH:mm" when the frame was shot
  flash?: boolean;
  filter?: string;     // from FILTER_OPTIONS
  weather?: string;    // from WEATHER_CONDITIONS
  rating?: number;     // 1–5 stars
  tags?: string[];     // free-form labels e.g. ["portrait", "street"]
}

export interface FilmPurchase {
  id: string;
  filmStockId: string;
  quantity: number;        // rolls bought
  quantityLoaded: number;  // rolls already loaded into a camera
  price?: number;          // total paid for the purchase
  purchasedAt: string;     // YYYY-MM-DD
  expiresAt?: string;      // YYYY-MM-DD
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LabDropoff {
  id: string;
  labName: string;
  droppedOffAt: string;      // YYYY-MM-DD
  expectedPickupAt?: string; // YYYY-MM-DD
  pickedUpAt?: string;       // YYYY-MM-DD
  cost?: number;
  labDevelops: boolean;
  labScans: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type DevProcess = "B&W" | "C-41" | "E-6" | "ECN-2";

export interface ChemicalSet {
  id: string;
  name: string;
  process: DevProcess;
  chemistryId: string;     // developer id (B&W) or kit id (colour) from the calculator data
  chemistryName: string;
  dilution?: string;
  volumeMl?: number;
  mixedAt: string;         // YYYY-MM-DD
  capacityRolls?: number;
  shelfLifeDays?: number;
  rollsUsed: number;
  minStockMlPerRoll?: number; // datasheet minimum of concentrate per roll, for dilute one-shot use
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DevBatch {
  id: string;
  chemicalSetId: string;
  process: DevProcess;
  tempC: number;
  timeSeconds: number;
  developedAt: string;     // YYYY-MM-DD
  rollIds: string[];
  fixer?: string;          // e.g. "Ilford Rapid Fixer"
  wettingAgent?: boolean;  // Photo-Flo / Ilfotol in the final rinse
  solutionMl?: number;     // working developer volume used in the tank
  notes?: string;
  createdAt: string;
}

export interface Roll {
  id: string;
  name?: string;           // Custom name e.g. "Yosemite Trip"
  filmStockId: string;
  cameraId: string;
  iso: string;
  frameCount: number;
  status: RollStatus;
  loadedAt: string;        // ISO date string
  labAt?: string;
  labDropoffId?: string;   // set while/after the roll is at a lab
  backedUpAt?: string;     // ISO time every attached scan last passed the backup check
  backedUpCount?: number;  // how many scans that check covered
  developedAt?: string;
  notes?: string;
  locationLabel?: string;  // Manual text location e.g. "Yosemite, CA"
  location?: Location;     // GPS coordinates (future)
  shots: Shot[];
  userId?: string;         // Supabase user ID (Phase 2)
  developer?: string;      // e.g. "Kodak D-76"
  dilution?: string;       // e.g. "1+1"
  devTime?: string;        // e.g. "8:30"
  devTemp?: string;        // e.g. "20°C"
  pushPull?: string;       // e.g. "+2", "-1" (stops from box speed)
  fixer?: string;          // e.g. "Kodak Rapid Fixer"
  photoFlo?: boolean;      // wetting agent used in final rinse
  isPublic?: boolean;   // whether others can view this roll's content on your profile
  createdAt: string;
  updatedAt: string;
}

export interface WalkStop {
  id: string;
  walkId: string;
  order: number;
  title: string;
  description?: string;
  locationLabel?: string;
  latitude?: number;
  longitude?: number;
}

export interface Walk {
  id: string;
  title: string;
  description?: string;
  city?: string;
  tags?: string[];
  estimatedMinutes?: number;
  distanceKm?: number;
  difficulty?: "Easy" | "Moderate" | "Challenging";
  isPublic: boolean;
  isFeatured?: boolean;
  createdByUserId?: string;
  stops: WalkStop[];
  completionCount: number;
  avgRating?: number;
  createdAt: string;
  updatedAt: string;
}

export interface WalkCompletion {
  id: string;
  walkId: string;
  userId: string;
  completedAt: string;
}

export interface WalkReview {
  id: string;
  walkId: string;
  userId: string;
  rating: number;
  body?: string;
  createdAt: string;
}

export interface UserProfile {
  userId: string;
  handle: string;       // lowercase alphanumeric + underscore, unique
  displayName?: string; // optional display name shown above @handle
  bio?: string;
  isPublic: boolean;
  avatarUrl?: string;   // public URL in the 'avatars' storage bucket
  createdAt: string;
}

export interface LocationJournal {
  id: string;
  locationLabel: string;
  body?: string;
  latitude?: number;    // representative coords for map pin
  longitude?: number;
  userId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
}

// ── Navigation param types ───────────────────────────────────────────────────

export type RootStackParamList = {
  "(tabs)": undefined;
  "roll/[id]": { id: string };
  "roll/new": undefined;
  "shot/[rollId]/[frame]": { rollId: string; frame: number };
  "settings/gear": undefined;
  "auth/login": undefined;
  "auth/signup": undefined;
};
