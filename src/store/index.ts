import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { supabase, deleteScan } from "@/services/supabase";
import { fetchRollSnapshot, runSyncOp, SyncSetupError } from "@/services/rollSyncApi";
import { Roll, Camera, FilmStock, User, Shot, LocationJournal, Walk, WalkStop, WalkCompletion, WalkReview, UserProfile, FilmPurchase, LabDropoff, ChemicalSet, DevBatch } from "@/types";
import { applyBatchToRolls, fillMissingFromBatches } from "@/utils/chemistry";
import { DEFAULT_CAMERAS, DEFAULT_FILM_STOCKS, normalizeStatus } from "@/constants";
import { computeBadgeStats, computeBadgeNotifications, AppNotification } from "@/utils/badges";
import { uid } from "@/utils";
import { DistanceUnit, TemperatureUnit } from "@/utils/units";
import {
  SyncMeta, SyncConflict, emptyMeta, reconcile, pendingOps, countPending, resolveConflict,
} from "@/utils/rollMerge";
import { ACCOUNT_SWITCH_BLOCKED_MESSAGE } from "@/utils/accountSyncSafety";

// ── Storage keys ──────────────────────────────────────────────────────────────
const KEYS = {
  rolls: "filmlog:rolls",
  cameras: "filmlog:cameras",
  filmStocks: "filmlog:filmStocks",
  userId: "filmlog:userId",
  journals: "filmlog:journals",
  personalWalks: "filmlog:personalWalks",
  completions: "filmlog:completions",
  myReviews: "filmlog:myReviews",
  shownNudges: "filmlog:shownNudges",
  purchases: "filmlog:purchases",
  dropoffs: "filmlog:dropoffs",
  chemSets: "filmlog:chemSets",
  batches: "filmlog:batches",
  preferences: "filmlog:preferences",
  rollSyncMeta: "filmlog:rollSyncMeta",
};

export interface RollSyncStatus {
  state: "idle" | "syncing" | "offline" | "setup-needed" | "error";
  lastSyncedAt?: string;
  error?: string;
}

// Sync runs one at a time; changes made while it runs trigger another round.
let syncRunning: Promise<void> | null = null;
let syncAgain = false;
let syncTimer: ReturnType<typeof setTimeout> | null = null;

/** Rolls synced from another device can use a custom camera or film this device hasn't loaded. */
async function loadMissingGear(userId: string): Promise<void> {
  const st = useFilmLogStore.getState();
  const cameraIds = new Set(st.cameras.map((c) => c.id));
  const stockIds = new Set(st.filmStocks.map((f) => f.id));
  const missingCamera = st.rolls.some((r) => !cameraIds.has(r.cameraId));
  const missingStock = st.rolls.some((r) => !stockIds.has(r.filmStockId));
  if (!missingCamera && !missingStock) return;
  try {
    const [cams, stocks] = await Promise.all([
      missingCamera ? supabase.from("cameras").select("*").eq("user_id", userId) : Promise.resolve(null),
      missingStock ? supabase.from("film_stocks").select("*").eq("user_id", userId) : Promise.resolve(null),
    ]);
    if (useFilmLogStore.getState().user?.id !== userId) return;
    useFilmLogStore.setState((cur) => ({
      cameras: [...cur.cameras, ...((cams?.data ?? []) as any[])
        .filter((c) => !cur.cameras.some((x) => x.id === c.id))
        .map((c) => ({ id: c.id, name: c.name, isCustom: true }))],
      filmStocks: [...cur.filmStocks, ...((stocks?.data ?? []) as any[])
        .filter((f) => !cur.filmStocks.some((x) => x.id === f.id))
        .map(dbToFilmStock)],
    }));
    void useFilmLogStore.getState().persist();
  } catch (e) {
    console.warn("Loading cameras/film for synced rolls failed:", e);
  }
}

const filmStockRow = (f: FilmStock, userId: string) =>
  ({ id: f.id, user_id: userId, name: f.name, iso: f.iso, process: f.process ?? null });

/** Writes custom film stocks; retries without `process` if supabase/19 hasn't been run yet. */
async function saveFilmStocks(mode: "insert" | "upsert", stocks: FilmStock[], userId: string): Promise<void> {
  const rows = stocks.map((f) => filmStockRow(f, userId));
  let { error } = await supabase.from("film_stocks")[mode](rows);
  if (error && /process/i.test(error.message)) {
    ({ error } = await supabase.from("film_stocks")[mode](rows.map(({ process: _p, ...r }) => r)));
  }
  if (error) console.error(`film stock ${mode}:`, error);
}

const dbToFilmStock = (r: any): FilmStock => ({ id: r.id, name: r.name, iso: r.iso, isCustom: true, process: r.process ?? undefined });

/** Stored copies of the default stocks predate `process`; fill it in from the defaults. */
const withDefaultProcesses = (stocks: FilmStock[]): FilmStock[] =>
  stocks.map((f) => f.process ? f : { ...f, process: DEFAULT_FILM_STOCKS.find((d) => d.id === f.id)?.process });

const isNetworkError = (e: unknown) =>
  e instanceof TypeError || /network request failed|failed to fetch|fetch failed|load failed/i.test(String((e as Error)?.message ?? e));

function chemSetToDb(c: ChemicalSet, userId: string) {
  return {
    id: c.id,
    user_id: userId,
    name: c.name,
    process: c.process,
    chemistry_id: c.chemistryId,
    chemistry_name: c.chemistryName,
    dilution: c.dilution ?? null,
    volume_ml: c.volumeMl ?? null,
    mixed_at: c.mixedAt,
    capacity_rolls: c.capacityRolls ?? null,
    shelf_life_days: c.shelfLifeDays ?? null,
    rolls_used: c.rollsUsed,
    min_stock_ml_per_roll: c.minStockMlPerRoll ?? null,
    notes: c.notes ?? null,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
}

function dbToChemSet(row: any): ChemicalSet {
  return {
    id: row.id,
    name: row.name,
    process: row.process,
    chemistryId: row.chemistry_id,
    chemistryName: row.chemistry_name,
    dilution: row.dilution ?? undefined,
    volumeMl: row.volume_ml ?? undefined,
    mixedAt: row.mixed_at,
    capacityRolls: row.capacity_rolls ?? undefined,
    shelfLifeDays: row.shelf_life_days ?? undefined,
    rollsUsed: row.rolls_used ?? 0,
    minStockMlPerRoll: row.min_stock_ml_per_roll != null ? Number(row.min_stock_ml_per_roll) : undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function batchToDb(b: DevBatch, userId: string) {
  return {
    id: b.id,
    user_id: userId,
    chemical_set_id: b.chemicalSetId,
    process: b.process,
    temp_c: b.tempC,
    time_seconds: b.timeSeconds,
    developed_at: b.developedAt,
    roll_ids: b.rollIds,
    fixer: b.fixer ?? null,
    wetting_agent: b.wettingAgent ?? null,
    solution_ml: b.solutionMl ?? null,
    notes: b.notes ?? null,
    created_at: b.createdAt,
  };
}

function dbToBatch(row: any): DevBatch {
  return {
    id: row.id,
    chemicalSetId: row.chemical_set_id,
    process: row.process,
    tempC: Number(row.temp_c),
    timeSeconds: row.time_seconds,
    developedAt: row.developed_at,
    rollIds: row.roll_ids ?? [],
    fixer: row.fixer ?? undefined,
    wettingAgent: row.wetting_agent ?? undefined,
    solutionMl: row.solution_ml ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
  };
}

function dropoffToDb(d: LabDropoff, userId: string) {
  return {
    id: d.id,
    user_id: userId,
    lab_name: d.labName,
    dropped_off_at: d.droppedOffAt,
    expected_pickup_at: d.expectedPickupAt ?? null,
    picked_up_at: d.pickedUpAt ?? null,
    cost: d.cost ?? null,
    lab_develops: d.labDevelops,
    lab_scans: d.labScans,
    notes: d.notes ?? null,
    created_at: d.createdAt,
    updated_at: d.updatedAt,
  };
}

function dbToDropoff(row: any): LabDropoff {
  return {
    id: row.id,
    labName: row.lab_name,
    droppedOffAt: row.dropped_off_at,
    expectedPickupAt: row.expected_pickup_at ?? undefined,
    pickedUpAt: row.picked_up_at ?? undefined,
    cost: row.cost != null ? Number(row.cost) : undefined,
    labDevelops: row.lab_develops,
    labScans: row.lab_scans,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function purchaseToDb(p: FilmPurchase, userId: string) {
  return {
    id: p.id,
    user_id: userId,
    film_stock_id: p.filmStockId,
    quantity: p.quantity,
    quantity_loaded: p.quantityLoaded,
    price: p.price ?? null,
    purchased_at: p.purchasedAt,
    expires_at: p.expiresAt ?? null,
    notes: p.notes ?? null,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

function dbToPurchase(row: any): FilmPurchase {
  return {
    id: row.id,
    filmStockId: row.film_stock_id,
    quantity: row.quantity,
    quantityLoaded: row.quantity_loaded,
    price: row.price != null ? Number(row.price) : undefined,
    purchasedAt: row.purchased_at,
    expiresAt: row.expires_at ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}


// ── Journal DB mappers ────────────────────────────────────────────────────────
function journalToDb(journal: LocationJournal, userId: string) {
  return {
    id: journal.id,
    user_id: userId,
    location_label: journal.locationLabel,
    body: journal.body ?? null,
    latitude: journal.latitude ?? null,
    longitude: journal.longitude ?? null,
    created_at: journal.createdAt,
    updated_at: journal.updatedAt,
  };
}

function dbToJournal(row: any): LocationJournal {
  return {
    id: row.id,
    locationLabel: row.location_label,
    body: row.body ?? undefined,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    userId: row.user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Walk DB mappers ───────────────────────────────────────────────────────────
function walkToDb(walk: Walk, userId: string) {
  return {
    id: walk.id,
    title: walk.title,
    description: walk.description ?? null,
    city: walk.city ?? null,
    tags: walk.tags ? JSON.stringify(walk.tags) : null,
    estimated_minutes: walk.estimatedMinutes ?? null,
    distance_km: walk.distanceKm ?? null,
    difficulty: walk.difficulty ?? null,
    is_public: walk.isPublic,
    is_featured: walk.isFeatured ?? false,
    created_by_user_id: userId,
    completion_count: walk.completionCount,
    avg_rating: walk.avgRating ?? null,
    created_at: walk.createdAt,
    updated_at: walk.updatedAt,
  };
}

function dbToWalk(row: any): Walk {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    city: row.city ?? undefined,
    tags: (() => { try { return row.tags ? JSON.parse(row.tags) : undefined; } catch { return undefined; } })(),
    estimatedMinutes: row.estimated_minutes ?? undefined,
    distanceKm: row.distance_km ?? undefined,
    difficulty: row.difficulty ?? undefined,
    isPublic: row.is_public,
    isFeatured: row.is_featured ?? undefined,
    createdByUserId: row.created_by_user_id,
    stops: (row.walk_stops ?? []).sort((a: any, b: any) => a.order_index - b.order_index).map(dbToWalkStop),
    completionCount: row.completion_count ?? 0,
    avgRating: row.avg_rating ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function walkStopToDb(stop: WalkStop, userId: string) {
  return {
    id: stop.id,
    walk_id: stop.walkId,
    user_id: userId,
    order_index: stop.order,
    title: stop.title,
    description: stop.description ?? null,
    location_label: stop.locationLabel ?? null,
    latitude: stop.latitude ?? null,
    longitude: stop.longitude ?? null,
  };
}

function dbToWalkStop(row: any): WalkStop {
  return {
    id: row.id,
    walkId: row.walk_id,
    order: row.order_index,
    title: row.title,
    description: row.description ?? undefined,
    locationLabel: row.location_label ?? undefined,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
  };
}

function completionToDb(c: WalkCompletion) {
  return { id: c.id, walk_id: c.walkId, user_id: c.userId, completed_at: c.completedAt };
}

function dbToCompletion(row: any): WalkCompletion {
  return { id: row.id, walkId: row.walk_id, userId: row.user_id, completedAt: row.completed_at };
}

function reviewToDb(r: WalkReview) {
  return { id: r.id, walk_id: r.walkId, user_id: r.userId, rating: r.rating, body: r.body ?? null, created_at: r.createdAt };
}

function dbToReview(row: any): WalkReview {
  return { id: row.id, walkId: row.walk_id, userId: row.user_id, rating: row.rating, body: row.body ?? undefined, createdAt: row.created_at };
}

function profileToDb(p: UserProfile) {
  return {
    user_id: p.userId,
    handle: p.handle,
    display_name: p.displayName ?? null,
    bio: p.bio ?? null,
    is_public: p.isPublic,
    avatar_url: p.avatarUrl ?? null,
  };
}

function dbToProfile(row: any): UserProfile {
  return {
    userId: row.user_id,
    handle: row.handle,
    displayName: row.display_name ?? undefined,
    bio: row.bio ?? undefined,
    isPublic: row.is_public,
    avatarUrl: row.avatar_url ?? undefined,
    createdAt: row.created_at,
  };
}

// ── Store shape ───────────────────────────────────────────────────────────────
interface FilmLogState {
  rolls: Roll[];
  purchases: FilmPurchase[];
  dropoffs: LabDropoff[];
  chemSets: ChemicalSet[];
  batches: DevBatch[];
  cameras: Camera[];
  filmStocks: FilmStock[];
  journals: LocationJournal[];
  personalWalks: Walk[];
  communityWalks: Walk[];   // memory-only, not persisted
  completions: WalkCompletion[];
  myReviews: WalkReview[];
  walkReviews: WalkReview[];   // all reviews for the currently viewed walk, memory-only
  myProfile: UserProfile | null;
  user: User | null;
  rollRealtimeStatus: "connecting" | "connected" | "disconnected" | "reconnected" | null;
  authSafetyError: string | null;
  hydrated: boolean;
  notifications: AppNotification[];
  shownProgressNudges: string[];
  temperatureUnit: TemperatureUnit;
  distanceUnit: DistanceUnit;

  /** What this device last agreed with the cloud for each roll and frame (see utils/rollMerge). */
  rollSyncMeta: SyncMeta;
  /** The account `rollSyncMeta` belongs to. */
  rollSyncOwner: string | null;
  rollSync: RollSyncStatus;
  syncConflicts: SyncConflict[];
  syncNotices: string[];
  runRollSync: () => Promise<void>;
  scheduleRollSync: (delayMs?: number) => void;
  resolveSyncConflict: (conflict: SyncConflict, choice: "local" | "remote" | Record<string, "local" | "remote">) => void;
  dismissSyncNotices: () => void;
  /** Roll/frame changes this device hasn't sent yet, plus unresolved conflicts. */
  unsyncedRollChanges: () => number;

  addRoll: (roll: Roll) => void;
  updateRoll: (roll: Roll) => void;
  deleteRoll: (id: string) => void;

  addPurchase: (purchase: FilmPurchase) => void;
  updatePurchase: (purchase: FilmPurchase) => void;
  deletePurchase: (id: string) => void;
  loadRollFromPurchase: (purchaseId: string, roll: Roll) => void;

  addDropoff: (dropoff: LabDropoff) => void;
  updateDropoff: (dropoff: LabDropoff) => void;
  addChemSet: (set: ChemicalSet) => void;
  updateChemSet: (set: ChemicalSet) => void;
  deleteChemSet: (id: string) => void;
  /** `stopsByRoll` is each roll's push (+) or pull (−) from the batch plan. */
  finishBatch: (batch: DevBatch, stopsByRoll?: Record<string, number>) => void;
  /** Fills empty development details on rolls from the batch they were developed in. */
  backfillBatchDetails: () => void;
  addShot: (rollId: string, shot: Shot) => void;
  createScanImportFrames: (rollId: string, frames: number[]) => Promise<void>;
  updateShot: (rollId: string, shot: Shot) => void;
  deleteShot: (rollId: string, shotId: string) => void;

  addCamera: (camera: Camera) => void;
  updateCamera: (camera: Camera) => void;
  deleteCamera: (id: string) => void;
  addFilmStock: (stock: FilmStock) => void;
  updateFilmStock: (stock: FilmStock) => void;
  deleteFilmStock: (id: string) => void;

  upsertJournal: (journal: LocationJournal) => void;
  deleteJournal: (id: string) => void;

  createWalk: (walk: Walk) => void;
  updateWalk: (walk: Walk) => void;
  deleteWalk: (id: string) => void;
  fetchCommunityWalks: () => Promise<void>;
  markWalkComplete: (completion: WalkCompletion) => void;
  unmarkWalkComplete: (completionId: string) => void;
  submitReview: (review: WalkReview) => void;
  deleteReview: (reviewId: string) => void;
  fetchWalkReviews: (walkId: string) => Promise<void>;

  dismissNotification: (id: string) => void;
  subscribeToCreatorNotifications: (userId: string) => () => void;
  subscribeToNewRolls: (userId: string) => () => void;

  loadMyProfile: () => Promise<void>;
  saveProfile: (data: { handle: string; displayName?: string; bio?: string; isPublic: boolean; avatarUrl?: string }) => Promise<{ error?: string }>;
  fetchPublicProfile: (userId: string) => Promise<UserProfile | null>;

  setUser: (user: User | null) => void;
  setTemperatureUnit: (unit: TemperatureUnit) => void;
  setDistanceUnit: (unit: DistanceUnit) => void;
  hydrate: () => Promise<void>;
  persist: () => Promise<void>;
  syncFromSupabase: (userId: string) => Promise<void>;
  uploadLocalToSupabase: (userId: string) => Promise<void>;
  clearUserData: () => void;
  clearAllData: () => void;
}

// ── Store ─────────────────────────────────────────────────────────────────────
export const useFilmLogStore = create<FilmLogState>((set, get) => ({
  rolls: [],
  purchases: [],
  dropoffs: [],
  chemSets: [],
  batches: [],
  cameras: DEFAULT_CAMERAS,
  filmStocks: DEFAULT_FILM_STOCKS,
  journals: [],
  personalWalks: [],
  communityWalks: [],
  completions: [],
  myReviews: [],
  walkReviews: [],
  myProfile: null,
  user: null,
  rollRealtimeStatus: null,
  authSafetyError: null,
  hydrated: false,
  notifications: [],
  shownProgressNudges: [],
  temperatureUnit: "C",
  distanceUnit: "km",
  rollSyncMeta: emptyMeta(),
  rollSyncOwner: null,
  rollSync: { state: "idle" },
  syncConflicts: [],
  syncNotices: [],

  // ── Rolls ──────────────────────────────────────────────────────────────────
  addRoll: (roll) => {
    const { rolls, personalWalks, completions, myReviews, user, shownProgressNudges } = get();
    const oldStats = computeBadgeStats(rolls, personalWalks, completions, myReviews, user?.id);
    set((s) => ({ rolls: [roll, ...s.rolls] }));
    get().persist();
    const s = get();
    const { notifications: n, newShownKeys } = computeBadgeNotifications(oldStats, s.rolls, s.personalWalks, s.completions, s.myReviews, s.user?.id, shownProgressNudges);
    if (n.length > 0 || newShownKeys.length > 0) {
      set((p) => ({ notifications: [...p.notifications, ...n], shownProgressNudges: [...p.shownProgressNudges, ...newShownKeys] }));
      if (newShownKeys.length > 0) AsyncStorage.setItem(KEYS.shownNudges, JSON.stringify([...shownProgressNudges, ...newShownKeys]));
    }
    get().scheduleRollSync();
  },

  updateRoll: (roll) => {
    const { rolls, personalWalks, completions, myReviews, user, shownProgressNudges } = get();
    const oldStats = computeBadgeStats(rolls, personalWalks, completions, myReviews, user?.id);
    set((s) => ({ rolls: s.rolls.map((r) => (r.id === roll.id ? roll : r)) }));
    get().persist();
    const s = get();
    const { notifications: n, newShownKeys } = computeBadgeNotifications(oldStats, s.rolls, s.personalWalks, s.completions, s.myReviews, s.user?.id, shownProgressNudges);
    if (n.length > 0 || newShownKeys.length > 0) {
      set((p) => ({ notifications: [...p.notifications, ...n], shownProgressNudges: [...p.shownProgressNudges, ...newShownKeys] }));
      if (newShownKeys.length > 0) AsyncStorage.setItem(KEYS.shownNudges, JSON.stringify([...shownProgressNudges, ...newShownKeys]));
    }
    get().scheduleRollSync();
  },

  // The cloud copy (and its scans) are removed by the next sync, guarded by revision.
  deleteRoll: (id) => {
    set((s) => ({ rolls: s.rolls.filter((r) => r.id !== id) }));
    get().persist();
    get().scheduleRollSync();
  },

  // ── Film inventory ─────────────────────────────────────────────────────────
  addPurchase: (purchase) => {
    set((s) => ({ purchases: [purchase, ...s.purchases] }));
    get().persist();
    const { user } = get();
    if (user) {
      supabase.from("film_purchases").insert(purchaseToDb(purchase, user.id))
        .then(({ error }) => { if (error) console.error("addPurchase sync:", error); });
    }
  },

  updatePurchase: (purchase) => {
    set((s) => ({ purchases: s.purchases.map((p) => (p.id === purchase.id ? purchase : p)) }));
    get().persist();
    const { user } = get();
    if (user) {
      supabase.from("film_purchases").upsert(purchaseToDb(purchase, user.id))
        .then(({ error }) => { if (error) console.error("updatePurchase sync:", error); });
    }
  },

  deletePurchase: (id) => {
    set((s) => ({ purchases: s.purchases.filter((p) => p.id !== id) }));
    get().persist();
    const { user } = get();
    if (user) {
      supabase.from("film_purchases").delete().eq("id", id)
        .then(({ error }) => { if (error) console.error("deletePurchase sync:", error); });
    }
  },

  // Creates the roll and uses up one roll from the purchase.
  loadRollFromPurchase: (purchaseId, roll) => {
    const purchase = get().purchases.find((p) => p.id === purchaseId);
    if (!purchase || purchase.quantityLoaded >= purchase.quantity) return;
    get().addRoll(roll);
    get().updatePurchase({
      ...purchase,
      quantityLoaded: purchase.quantityLoaded + 1,
      updatedAt: new Date().toISOString(),
    });
  },

  // ── Lab drop-offs ──────────────────────────────────────────────────────────
  addDropoff: (dropoff) => {
    set((s) => ({ dropoffs: [dropoff, ...s.dropoffs] }));
    get().persist();
    const { user } = get();
    if (user) {
      supabase.from("lab_dropoffs").insert(dropoffToDb(dropoff, user.id))
        .then(({ error }) => { if (error) console.error("addDropoff sync:", error); });
    }
  },

  updateDropoff: (dropoff) => {
    set((s) => ({ dropoffs: s.dropoffs.map((d) => (d.id === dropoff.id ? dropoff : d)) }));
    get().persist();
    const { user } = get();
    if (user) {
      supabase.from("lab_dropoffs").upsert(dropoffToDb(dropoff, user.id))
        .then(({ error }) => { if (error) console.error("updateDropoff sync:", error); });
    }
  },

  // ── Chemical sets & batches ────────────────────────────────────────────────
  addChemSet: (chemSet) => {
    set((s) => ({ chemSets: [chemSet, ...s.chemSets] }));
    get().persist();
    const { user } = get();
    if (user) {
      supabase.from("chemical_sets").insert(chemSetToDb(chemSet, user.id))
        .then(({ error }) => { if (error) console.error("addChemSet sync:", error); });
    }
  },

  updateChemSet: (chemSet) => {
    set((s) => ({ chemSets: s.chemSets.map((c) => (c.id === chemSet.id ? chemSet : c)) }));
    get().persist();
    const { user } = get();
    if (user) {
      supabase.from("chemical_sets").upsert(chemSetToDb(chemSet, user.id))
        .then(({ error }) => { if (error) console.error("updateChemSet sync:", error); });
    }
  },

  deleteChemSet: (id) => {
    set((s) => ({ chemSets: s.chemSets.filter((c) => c.id !== id) }));
    get().persist();
    const { user } = get();
    if (user) {
      supabase.from("chemical_sets").delete().eq("id", id)
        .then(({ error }) => { if (error) console.error("deleteChemSet sync:", error); });
    }
  },

  // Saves the batch, moves its rolls to In Scanning with the development details, and counts the rolls against the set.
  backfillBatchDetails: () => {
    const { rolls, batches, chemSets } = get();
    const next = fillMissingFromBatches(rolls, batches, chemSets, new Date().toISOString());
    if (next === rolls) return;
    set({ rolls: next });
    void get().persist();
    get().scheduleRollSync();
  },

  finishBatch: (batch, stopsByRoll = {}) => {
    const state = get();
    const chemSet = state.chemSets.find((c) => c.id === batch.chemicalSetId);
    if (!chemSet) return;
    const now = new Date().toISOString();
    const before = new Map(state.rolls.map((r) => [r.id, r]));
    const rolls = applyBatchToRolls(state.rolls, batch, chemSet, now, stopsByRoll);
    const changed = rolls.filter((r) => r !== before.get(r.id));
    const updatedSet: ChemicalSet = { ...chemSet, rollsUsed: chemSet.rollsUsed + changed.length, updatedAt: now };
    set((s) => ({
      rolls,
      batches: [batch, ...s.batches],
      chemSets: s.chemSets.map((c) => (c.id === updatedSet.id ? updatedSet : c)),
    }));
    get().persist();
    const { user } = get();
    if (user) {
      supabase.from("dev_batches").insert(batchToDb(batch, user.id))
        .then(({ error }) => { if (error) console.error("finishBatch sync:", error); });
      supabase.from("chemical_sets").upsert(chemSetToDb(updatedSet, user.id))
        .then(({ error }) => { if (error) console.error("finishBatch set sync:", error); });
    }
    if (changed.length > 0) get().scheduleRollSync();
  },

  // ── Shots ──────────────────────────────────────────────────────────────────
  // Adds empty frames so every scan in an import has a frame to attach to.
  createScanImportFrames: async (rollId, frames) => {
    const roll = get().rolls.find((item) => item.id === rollId);
    if (!roll) throw new Error("Roll not found.");
    if (frames.length === 0 || frames.some((frame) => !Number.isInteger(frame) || frame < 1) ||
      new Set(frames).size !== frames.length || frames.some((frame) => roll.shots.some((shot) => shot.frame === frame))) {
      throw new Error("Frame numbers are invalid or already in use.");
    }
    const shots: Shot[] = frames.map((frame) => ({ id: uid(), frame }));
    get().updateRoll({
      ...roll,
      shots: [...roll.shots, ...shots].sort((x, y) => x.frame - y.frame),
      frameCount: Math.max(roll.frameCount, ...frames),
      updatedAt: new Date().toISOString(),
    });
  },

  addShot: (rollId, shot) => {
    const { rolls, personalWalks, completions, myReviews, user, shownProgressNudges } = get();
    const oldStats = computeBadgeStats(rolls, personalWalks, completions, myReviews, user?.id);
    set((s) => ({
      rolls: s.rolls.map((r) =>
        r.id === rollId ? { ...r, shots: [...r.shots, shot], updatedAt: new Date().toISOString() } : r
      ),
    }));
    get().persist();
    const s = get();
    const { notifications: n, newShownKeys } = computeBadgeNotifications(oldStats, s.rolls, s.personalWalks, s.completions, s.myReviews, s.user?.id, shownProgressNudges, rollId);
    if (n.length > 0 || newShownKeys.length > 0) {
      set((p) => ({ notifications: [...p.notifications, ...n], shownProgressNudges: [...p.shownProgressNudges, ...newShownKeys] }));
      if (newShownKeys.length > 0) AsyncStorage.setItem(KEYS.shownNudges, JSON.stringify([...shownProgressNudges, ...newShownKeys]));
    }
    get().scheduleRollSync();
  },

  updateShot: (rollId, shot) => {
    const { rolls, personalWalks, completions, myReviews, user, shownProgressNudges } = get();
    const oldStats = computeBadgeStats(rolls, personalWalks, completions, myReviews, user?.id);
    set((s) => ({
      rolls: s.rolls.map((r) =>
        r.id === rollId
          ? { ...r, shots: r.shots.map((sh) => (sh.id === shot.id ? shot : sh)), updatedAt: new Date().toISOString() }
          : r
      ),
    }));
    get().persist();
    const s = get();
    const { notifications: n, newShownKeys } = computeBadgeNotifications(oldStats, s.rolls, s.personalWalks, s.completions, s.myReviews, s.user?.id, shownProgressNudges);
    if (n.length > 0 || newShownKeys.length > 0) {
      set((p) => ({ notifications: [...p.notifications, ...n], shownProgressNudges: [...p.shownProgressNudges, ...newShownKeys] }));
      if (newShownKeys.length > 0) AsyncStorage.setItem(KEYS.shownNudges, JSON.stringify([...shownProgressNudges, ...newShownKeys]));
    }
    get().scheduleRollSync();
  },

  deleteShot: (rollId, shotId) => {
    set((s) => ({
      rolls: s.rolls.map((r) =>
        r.id === rollId
          ? { ...r, shots: r.shots.filter((sh) => sh.id !== shotId), updatedAt: new Date().toISOString() }
          : r
      ),
    }));
    get().persist();
    get().scheduleRollSync();
  },

  // ── Gear ───────────────────────────────────────────────────────────────────
  addCamera: (camera) => {
    const { rolls, personalWalks, completions, myReviews, user, shownProgressNudges } = get();
    const oldStats = computeBadgeStats(rolls, personalWalks, completions, myReviews, user?.id);
    set((s) => ({ cameras: [...s.cameras, camera] }));
    get().persist();
    const s = get();
    const { notifications: n, newShownKeys } = computeBadgeNotifications(oldStats, s.rolls, s.personalWalks, s.completions, s.myReviews, s.user?.id, shownProgressNudges);
    if (n.length > 0 || newShownKeys.length > 0) {
      set((p) => ({ notifications: [...p.notifications, ...n], shownProgressNudges: [...p.shownProgressNudges, ...newShownKeys] }));
      if (newShownKeys.length > 0) AsyncStorage.setItem(KEYS.shownNudges, JSON.stringify([...shownProgressNudges, ...newShownKeys]));
    }
    if (user) {
      supabase.from("cameras").insert({ id: camera.id, user_id: user.id, name: camera.name })
        .then(({ error }) => { if (error) console.error("addCamera sync:", error); });
    }
  },

  updateCamera: (camera) => {
    set((s) => ({ cameras: s.cameras.map((c) => (c.id === camera.id ? camera : c)) }));
    get().persist();
    const { user } = get();
    if (user) {
      supabase.from("cameras").upsert({ id: camera.id, user_id: user.id, name: camera.name })
        .then(({ error }) => { if (error) console.error("updateCamera sync:", error); });
    }
  },

  deleteCamera: (id) => {
    set((s) => ({ cameras: s.cameras.filter((c) => c.id !== id) }));
    get().persist();
    const { user } = get();
    if (user) {
      supabase.from("cameras").delete().eq("id", id)
        .then(({ error }) => { if (error) console.error("deleteCamera sync:", error); });
    }
  },

  addFilmStock: (stock) => {
    const { rolls, personalWalks, completions, myReviews, user, shownProgressNudges } = get();
    const oldStats = computeBadgeStats(rolls, personalWalks, completions, myReviews, user?.id);
    set((s) => ({ filmStocks: [...s.filmStocks, stock] }));
    get().persist();
    const s = get();
    const { notifications: n, newShownKeys } = computeBadgeNotifications(oldStats, s.rolls, s.personalWalks, s.completions, s.myReviews, s.user?.id, shownProgressNudges);
    if (n.length > 0 || newShownKeys.length > 0) {
      set((p) => ({ notifications: [...p.notifications, ...n], shownProgressNudges: [...p.shownProgressNudges, ...newShownKeys] }));
      if (newShownKeys.length > 0) AsyncStorage.setItem(KEYS.shownNudges, JSON.stringify([...shownProgressNudges, ...newShownKeys]));
    }
    if (user) {
      void saveFilmStocks("insert", [stock], user.id);
    }
  },

  updateFilmStock: (stock) => {
    set((s) => ({ filmStocks: s.filmStocks.map((f) => (f.id === stock.id ? stock : f)) }));
    get().persist();
    const { user } = get();
    if (user) {
      void saveFilmStocks("upsert", [stock], user.id);
    }
  },

  deleteFilmStock: (id) => {
    set((s) => ({ filmStocks: s.filmStocks.filter((f) => f.id !== id) }));
    get().persist();
    const { user } = get();
    if (user) {
      supabase.from("film_stocks").delete().eq("id", id)
        .then(({ error }) => { if (error) console.error("deleteFilmStock sync:", error); });
    }
  },

  // ── Journals ───────────────────────────────────────────────────────────────
  upsertJournal: (journal) => {
    const userId = get().user?.id;
    set((state) => {
      const idx = state.journals.findIndex(
        (j) => j.id === journal.id || j.locationLabel.toLowerCase() === journal.locationLabel.toLowerCase()
      );
      const journals = idx >= 0
        ? state.journals.map((j, i) => (i === idx ? journal : j))
        : [...state.journals, journal];
      if (userId) {
        supabase.from("location_journals")
          .upsert(journalToDb(journal, userId))
          .then(({ error }) => { if (error) console.error("upsertJournal sync:", error); });
      }
      return { journals };
    });
    get().persist();
  },

  deleteJournal: (id) => {
    const userId = get().user?.id;
    set((s) => ({ journals: s.journals.filter((j) => j.id !== id) }));
    get().persist();
    if (userId) {
      supabase.from("location_journals").delete().eq("id", id)
        .then(({ error }) => { if (error) console.error("deleteJournal sync:", error); });
    }
  },

  // ── Walks ──────────────────────────────────────────────────────────────────
  createWalk: (walk) => {
    set((s) => ({ personalWalks: [walk, ...s.personalWalks] }));
    get().persist();
    const { user } = get();
    if (user && walk.isPublic) {
      const allStops = walk.stops.map((st) => walkStopToDb(st, user.id));
      supabase.from("walks").insert(walkToDb(walk, user.id))
        .then(({ error }) => { if (error) console.error("createWalk sync:", error); });
      if (allStops.length > 0) {
        supabase.from("walk_stops").insert(allStops)
          .then(({ error }) => { if (error) console.error("createWalk stops sync:", error); });
      }
    }
  },

  updateWalk: (walk) => {
    set((s) => ({ personalWalks: s.personalWalks.map((w) => (w.id === walk.id ? walk : w)) }));
    get().persist();
    const { user } = get();
    if (user) {
      supabase.from("walks").upsert(walkToDb(walk, user.id))
        .then(({ error }) => { if (error) console.error("updateWalk sync:", error); });
      supabase.from("walk_stops").delete().eq("walk_id", walk.id)
        .then(() => {
          if (walk.stops.length > 0) {
            supabase.from("walk_stops").insert(walk.stops.map((st) => walkStopToDb(st, user.id)))
              .then(({ error }) => { if (error) console.error("updateWalk stops sync:", error); });
          }
        });
    }
  },

  deleteWalk: (id) => {
    set((s) => ({ personalWalks: s.personalWalks.filter((w) => w.id !== id) }));
    get().persist();
    const { user } = get();
    if (user) {
      supabase.from("walks").delete().eq("id", id)
        .then(({ error }) => { if (error) console.error("deleteWalk sync:", error); });
    }
  },

  fetchCommunityWalks: async () => {
    try {
      const { data, error } = await supabase
        .from("walks")
        .select("*, walk_stops(*)")
        .eq("is_public", true)
        .order("is_featured", { ascending: false })
        .order("completion_count", { ascending: false });
      if (error) { console.error("fetchCommunityWalks:", error); return; }
      set({ communityWalks: (data ?? []).map(dbToWalk) });
    } catch (e) {
      console.error("fetchCommunityWalks failed:", e);
    }
  },

  markWalkComplete: (completion) => {
    const { rolls, personalWalks, completions, myReviews, user, shownProgressNudges } = get();
    const oldStats = computeBadgeStats(rolls, personalWalks, completions, myReviews, user?.id);
    set((s) => ({ completions: [...s.completions, completion] }));
    get().persist();
    const s = get();
    const { notifications: n, newShownKeys } = computeBadgeNotifications(oldStats, s.rolls, s.personalWalks, s.completions, s.myReviews, s.user?.id, shownProgressNudges);
    if (n.length > 0 || newShownKeys.length > 0) {
      set((p) => ({ notifications: [...p.notifications, ...n], shownProgressNudges: [...p.shownProgressNudges, ...newShownKeys] }));
      if (newShownKeys.length > 0) AsyncStorage.setItem(KEYS.shownNudges, JSON.stringify([...shownProgressNudges, ...newShownKeys]));
    }
    if (user) {
      supabase.from("walk_completions").insert(completionToDb(completion))
        .then(({ error }) => { if (error) console.error("markWalkComplete sync:", error); });
    }
  },

  unmarkWalkComplete: (completionId) => {
    const completion = get().completions.find((c) => c.id === completionId);
    set((s) => ({ completions: s.completions.filter((c) => c.id !== completionId) }));
    get().persist();
    const { user } = get();
    if (user && completion) {
      supabase.from("walk_completions").delete().eq("id", completionId)
        .then(({ error }) => { if (error) console.error("unmarkWalkComplete sync:", error); });
    }
  },

  submitReview: (review) => {
    const { rolls, personalWalks, completions, myReviews, user, shownProgressNudges } = get();
    const oldStats = computeBadgeStats(rolls, personalWalks, completions, myReviews, user?.id);
    set((s) => ({
      myReviews: [...s.myReviews.filter((r) => r.walkId !== review.walkId), review],
    }));
    get().persist();
    const s = get();
    const { notifications: n, newShownKeys } = computeBadgeNotifications(oldStats, s.rolls, s.personalWalks, s.completions, s.myReviews, s.user?.id, shownProgressNudges);
    if (n.length > 0 || newShownKeys.length > 0) {
      set((p) => ({ notifications: [...p.notifications, ...n], shownProgressNudges: [...p.shownProgressNudges, ...newShownKeys] }));
      if (newShownKeys.length > 0) AsyncStorage.setItem(KEYS.shownNudges, JSON.stringify([...shownProgressNudges, ...newShownKeys]));
    }
    if (user) {
      supabase.from("walk_reviews").upsert(reviewToDb(review))
        .then(({ error }) => {
          if (error) { console.error("submitReview sync:", error); return; }
          get().fetchWalkReviews(review.walkId);
        });
    }
  },

  deleteReview: (reviewId) => {
    const review = get().myReviews.find((r) => r.id === reviewId);
    if (!review) return;
    set((s) => ({ myReviews: s.myReviews.filter((r) => r.id !== reviewId) }));
    get().persist();
    const { user } = get();
    if (user) {
      supabase.from("walk_reviews").delete().eq("id", reviewId)
        .then(({ error }) => {
          if (error) {
            console.error("deleteReview sync:", error);
            // Restore locally if Supabase rejected — prevents it reappearing on next sync
            set((s) => ({ myReviews: [...s.myReviews.filter((r) => r.id !== review.id), review] }));
            get().persist();
          } else {
            // Refresh the community reviews list for this walk
            get().fetchWalkReviews(review.walkId);
          }
        });
    }
  },

  fetchWalkReviews: async (walkId) => {
    const { data, error } = await supabase
      .from("walk_reviews")
      .select("*")
      .eq("walk_id", walkId)
      .order("created_at", { ascending: false });
    if (!error && data) {
      set({ walkReviews: data.map(dbToReview) });
    }
  },

  dismissNotification: (id) => {
    set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) }));
  },

  subscribeToCreatorNotifications: (userId) => {
    // Track walkId:completerId pairs recently notified to prevent duplicates
    // when both the completion and review Realtime events fire for the same action
    const notified = new Set<string>();

    function pushWalkNotif(walkTitle: string, review: { rating: number; body?: string } | null) {
      set((s) => ({
        notifications: [
          ...s.notifications,
          {
            id: uid(),
            type: "walk_completed" as const,
            emoji: "👟",
            title: walkTitle,
            message: "A photographer just completed your walk.",
            subtitle: review ? "★".repeat(review.rating) + "☆".repeat(5 - review.rating) : undefined,
            subtext: review?.body,
          },
        ],
      }));
    }

    // Primary trigger: walk_reviews INSERT — fires when the reviewer submits a rating/review
    // The walk_reviews_select policy already lets walk creators see reviews on their walks,
    // so Realtime delivers these events. This is the richest source (has stars + body).
    const reviewChannel = supabase
      .channel(`creator-reviews-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "walk_reviews" },
        (payload: any) => {
          const row = payload.new;
          if (row.user_id === userId) return;
          const walk = get().personalWalks.find((w) => w.id === row.walk_id);
          if (!walk) return;
          const key = `${row.walk_id}:${row.user_id}`;
          notified.add(key);
          setTimeout(() => notified.delete(key), 10000);
          pushWalkNotif(walk.title, dbToReview(row));
        }
      )
      .subscribe();

    // Secondary trigger: walk_completions INSERT — fires for users who complete without reviewing.
    // Waits 4s then fires only if the review channel hasn't already handled this pair.
    const completionChannel = supabase
      .channel(`creator-completions-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "walk_completions" },
        async (payload: any) => {
          const row = payload.new;
          if (row.user_id === userId) return;
          const walk = get().personalWalks.find((w) => w.id === row.walk_id);
          if (!walk) return;
          const key = `${row.walk_id}:${row.user_id}`;
          // Give the review channel time to fire first
          await new Promise((r) => setTimeout(r, 4000));
          if (notified.has(key)) return; // review channel already sent a notification
          notified.add(key);
          setTimeout(() => notified.delete(key), 10000);
          pushWalkNotif(walk.title, null);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(reviewChannel);
      supabase.removeChannel(completionChannel);
    };
  },

  // ── Profiles ───────────────────────────────────────────────────────────────
  loadMyProfile: async () => {
    const { user } = get();
    if (!user) return;
    const { data, error } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
    if (!error && data) set({ myProfile: dbToProfile(data) });
  },

  saveProfile: async ({ handle, displayName, bio, isPublic, avatarUrl }) => {
    const { user, myProfile } = get();
    if (!user) return { error: "Not signed in." };
    const cleanHandle = handle.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (cleanHandle.length < 3) return { error: "Handle must be at least 3 characters." };
    if (cleanHandle.length > 20) return { error: "Handle must be 20 characters or fewer." };
    const profile: UserProfile = {
      userId: user.id,
      handle: cleanHandle,
      displayName: displayName?.trim() || undefined,
      bio: bio?.trim() || undefined,
      isPublic,
      avatarUrl: avatarUrl ?? myProfile?.avatarUrl,
      createdAt: myProfile?.createdAt ?? new Date().toISOString(),
    };
    const { error } = await supabase.from("profiles").upsert(profileToDb(profile), { onConflict: "user_id" });
    if (error) {
      if (error.code === "23505") return { error: "That handle is already taken." };
      return { error: error.message };
    }
    set({ myProfile: profile });
    return {};
  },

  fetchPublicProfile: async (userId) => {
    const { data, error } = await supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle();
    if (error || !data) return null;
    return dbToProfile(data);
  },

  // ── Auth ───────────────────────────────────────────────────────────────────
  setUser: (user) => {
    set((state) => ({
      user,
      rollRealtimeStatus: state.user?.id === user?.id ? state.rollRealtimeStatus : null,
    }));
    // Persist the userId so sign-in can detect a different account on the same device
    if (user) {
      AsyncStorage.setItem(KEYS.userId, user.id);
    } else {
      AsyncStorage.removeItem(KEYS.userId);
    }
  },
  setTemperatureUnit: (temperatureUnit) => {
    set({ temperatureUnit });
    get().persist();
  },
  setDistanceUnit: (distanceUnit) => {
    set({ distanceUnit });
    get().persist();
  },

  // Sign-out: clears session and gear but KEEPS rolls in state and localStorage.
  // Rolls are local-first data — they survive sign-out so the same user gets them
  // back on re-login without depending on a successful Supabase round-trip.
  // userId is intentionally kept in AsyncStorage so _layout can detect a different
  // account logging in and wipe local data before uploading.
  clearUserData: () => {
    if (syncTimer) { clearTimeout(syncTimer); syncTimer = null; }
    set({ cameras: DEFAULT_CAMERAS, filmStocks: DEFAULT_FILM_STOCKS, user: null, myProfile: null, notifications: [], rollRealtimeStatus: null });
    AsyncStorage.multiRemove([KEYS.cameras, KEYS.filmStocks]);
  },

  // Hard reset: wipes everything including rolls. Called only when a different
  // account signs in on this device.
  clearAllData: () => {
    if (get().unsyncedRollChanges() > 0) throw new Error(ACCOUNT_SWITCH_BLOCKED_MESSAGE);
    set({ rolls: [], purchases: [], dropoffs: [], chemSets: [], batches: [], cameras: DEFAULT_CAMERAS, filmStocks: DEFAULT_FILM_STOCKS, journals: [], personalWalks: [], communityWalks: [], completions: [], myReviews: [], walkReviews: [], myProfile: null, user: null, notifications: [], shownProgressNudges: [], rollRealtimeStatus: null, rollSyncMeta: emptyMeta(), rollSyncOwner: null, rollSync: { state: "idle" }, syncConflicts: [], syncNotices: [] });
    AsyncStorage.multiRemove([KEYS.rolls, KEYS.purchases, KEYS.dropoffs, KEYS.chemSets, KEYS.batches, KEYS.cameras, KEYS.filmStocks, KEYS.journals, KEYS.personalWalks, KEYS.completions, KEYS.myReviews, KEYS.userId, KEYS.shownNudges, KEYS.rollSyncMeta]);
  },

  // ── Supabase sync ──────────────────────────────────────────────────────────
  // Keeps this device in step with the cloud: realtime nudges, a periodic check,
  // and a check whenever the app comes back to the foreground.
  subscribeToNewRolls: (userId) => {
    let active = true;
    let interrupted = false;
    if (get().user?.id === userId) set({ rollRealtimeStatus: "connecting" });
    const nudge = () => { if (active && get().user?.id === userId) get().scheduleRollSync(800); };

    const channel = supabase
      .channel(`roll-changes-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rolls", filter: `user_id=eq.${userId}` }, nudge)
      .on("postgres_changes", { event: "*", schema: "public", table: "shots", filter: `user_id=eq.${userId}` }, nudge)
      .subscribe((status, error) => {
        if (!active || get().user?.id !== userId) return;
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          interrupted = true;
          set({ rollRealtimeStatus: "disconnected" });
          console.warn("Roll realtime subscription failed:", status, error?.message ?? "No further details available.");
        } else if (status === "SUBSCRIBED") {
          set({ rollRealtimeStatus: interrupted ? "reconnected" : "connected" });
          if (interrupted) nudge(); // catch up on anything missed while disconnected
        } else if (status === "CLOSED") {
          interrupted = true;
          set({ rollRealtimeStatus: "disconnected" });
        }
      });

    const interval = setInterval(nudge, 60_000);
    const appState = AppState.addEventListener?.("change", (state) => { if (state === "active") nudge(); });

    return () => {
      active = false;
      clearInterval(interval);
      appState?.remove();
      void supabase.removeChannel(channel);
    };
  },

  // ── Roll & frame sync (see utils/rollMerge for the rules) ─────────────────
  scheduleRollSync: (delayMs = 1500) => {
    if (!get().user) return;
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => { syncTimer = null; void get().runRollSync(); }, delayMs);
  },

  runRollSync: async () => {
    const user = get().user;
    if (!user) return;
    if (syncRunning) { syncAgain = true; return syncRunning; }

    const owner = get().rollSyncOwner;
    if (owner && owner !== user.id) {
      set({ rollSync: { state: "error", error: "This device's rolls belong to a different account. Sign in to that account to sync them." } });
      return;
    }
    if (!owner) set({ rollSyncOwner: user.id });

    const sameUser = () => get().user?.id === user.id;
    const saveMeta = () => AsyncStorage.setItem(KEYS.rollSyncMeta, JSON.stringify({ owner: user.id, meta: get().rollSyncMeta }))
      .catch((e) => console.error("Saving sync state failed:", e));

    syncRunning = (async () => {
      set((st) => ({ rollSync: { ...st.rollSync, state: "syncing", error: undefined } }));
      try {
        for (let round = 0; round < 4; round++) {
          syncAgain = false;
          const snapshot = await fetchRollSnapshot(user.id);
          if (!sameUser()) return;

          // Pull: merge the cloud into local state in one synchronous step.
          const state = get();
          const pulled = reconcile(state.rolls, state.rollSyncMeta, snapshot);
          set({
            rolls: pulled.rolls,
            rollSyncMeta: pulled.meta,
            syncConflicts: pulled.conflicts,
            syncNotices: pulled.notices.length ? [...state.syncNotices, ...pulled.notices] : state.syncNotices,
          });
          void get().persist();
          void saveMeta();
          void loadMissingGear(user.id);

          // Push: send local changes, each guarded by the revision it was based on.
          let stale = false;
          for (const op of pendingOps(get().rolls, get().rollSyncMeta, pulled.conflicts)) {
            if (!sameUser()) return;
            const result = await runSyncOp(op);
            if (result.status === "conflict") { stale = true; continue; }
            const meta = get().rollSyncMeta;
            const next: SyncMeta = { rolls: { ...meta.rolls }, shots: { ...meta.shots } };
            let oldScan: string | null = null;
            if (op.type === "write-roll" && result.status === "saved") {
              next.rolls[op.id] = { revision: result.revision, fields: op.fields };
            } else if (op.type === "write-shot" && result.status === "saved") {
              const before = meta.shots[op.id]?.fields.scan_uri;
              if (typeof before === "string" && before !== op.fields.scan_uri) oldScan = before;
              next.shots[op.id] = { revision: result.revision, fields: op.fields, rollId: op.rollId };
            } else if (op.type === "delete-shot") {
              delete next.shots[op.id];
              oldScan = op.scanUri;
            } else if (op.type === "delete-roll") {
              delete next.rolls[op.id];
            }
            set({ rollSyncMeta: next });
            // The cloud has accepted the change, so nothing points at the old scan any more.
            if (oldScan) deleteScan(oldScan).catch((e) => console.warn("Old scan cleanup failed:", e));
          }
          void saveMeta();
          if (!stale && !syncAgain) break;
        }
        set({ rollSync: { state: "idle", lastSyncedAt: new Date().toISOString() } });
        // Rolls pulled from the cloud may come from batches that predate copying details.
        get().backfillBatchDetails();
      } catch (e) {
        console.warn("Roll sync failed:", e);
        set((st) => ({
          rollSync: {
            ...st.rollSync,
            state: e instanceof SyncSetupError ? "setup-needed" : isNetworkError(e) ? "offline" : "error",
            error: e instanceof Error ? e.message : String(e),
          },
        }));
      } finally {
        syncRunning = null;
        if (syncAgain) { syncAgain = false; get().scheduleRollSync(); }
      }
    })();
    return syncRunning;
  },

  resolveSyncConflict: (conflict, choice) => {
    const { rolls, rollSyncMeta } = get();
    const next = resolveConflict(rolls, rollSyncMeta, conflict, choice, uid);
    set((st) => ({
      rolls: next.rolls,
      rollSyncMeta: next.meta,
      syncConflicts: st.syncConflicts.filter((c) => !(c.kind === conflict.kind && c.id === conflict.id)),
    }));
    void get().persist();
    void AsyncStorage.setItem(KEYS.rollSyncMeta, JSON.stringify({ owner: get().rollSyncOwner, meta: next.meta }));
    get().scheduleRollSync(0);
  },

  dismissSyncNotices: () => set({ syncNotices: [] }),

  unsyncedRollChanges: () => {
    const { rolls, rollSyncMeta, syncConflicts } = get();
    return countPending(rolls, rollSyncMeta) + syncConflicts.length;
  },

  syncFromSupabase: async (userId) => {
    try {
      const [camerasRes, stocksRes, journalsRes, walksRes, completionsRes, reviewsRes, purchasesRes, dropoffsRes, chemSetsRes, batchesRes] = await Promise.all([
        supabase.from("cameras").select("*").eq("user_id", userId),
        supabase.from("film_stocks").select("*").eq("user_id", userId),
        supabase.from("location_journals").select("*").eq("user_id", userId),
        supabase.from("walks").select("*, walk_stops(*)").eq("created_by_user_id", userId),
        supabase.from("walk_completions").select("*").eq("user_id", userId),
        supabase.from("walk_reviews").select("*").eq("user_id", userId),
        supabase.from("film_purchases").select("*").eq("user_id", userId),
        supabase.from("lab_dropoffs").select("*").eq("user_id", userId),
        supabase.from("chemical_sets").select("*").eq("user_id", userId),
        supabase.from("dev_batches").select("*").eq("user_id", userId),
      ]);

      // Rolls and frames sync separately, with conflict protection (runRollSync).
      void get().runRollSync();

      if (camerasRes.error || stocksRes.error) {
        console.error("syncFromSupabase query error:", camerasRes.error ?? stocksRes.error);
        return;
      }

      const customCameras: Camera[] = (camerasRes.data ?? []).map((r: any) => ({
        id: r.id, name: r.name, isCustom: true,
      }));
      const customStocks: FilmStock[] = (stocksRes.data ?? []).map(dbToFilmStock);

      let journals = get().journals;
      if (!journalsRes.error && journalsRes.data) {
        const remoteJournals = journalsRes.data.map(dbToJournal);
        const remoteLabels = new Set(remoteJournals.map((j) => j.locationLabel.toLowerCase()));
        const localOnlyJournals = journals.filter((j) => !remoteLabels.has(j.locationLabel.toLowerCase()));
        journals = [...remoteJournals, ...localOnlyJournals];
      }

      let personalWalks = get().personalWalks;
      if (!walksRes.error && walksRes.data) {
        const remoteWalks = walksRes.data.map(dbToWalk);
        const remoteWalkIds = new Set(remoteWalks.map((w) => w.id));
        const localOnlyWalks = personalWalks.filter((w) => !remoteWalkIds.has(w.id));
        personalWalks = [...remoteWalks, ...localOnlyWalks];
      }

      const completions = !completionsRes.error && completionsRes.data
        ? completionsRes.data.map(dbToCompletion)
        : get().completions;
      const myReviews = !reviewsRes.error && reviewsRes.data
        ? reviewsRes.data.map(dbToReview)
        : get().myReviews;

      let purchases = get().purchases;
      if (!purchasesRes.error && purchasesRes.data) {
        const remotePurchases = purchasesRes.data.map(dbToPurchase);
        const remotePurchaseIds = new Set(remotePurchases.map((p) => p.id));
        purchases = [...remotePurchases, ...purchases.filter((p) => !remotePurchaseIds.has(p.id))];
      }

      let dropoffs = get().dropoffs;
      if (!dropoffsRes.error && dropoffsRes.data) {
        const remoteDropoffs = dropoffsRes.data.map(dbToDropoff);
        const remoteDropoffIds = new Set(remoteDropoffs.map((d) => d.id));
        dropoffs = [...remoteDropoffs, ...dropoffs.filter((d) => !remoteDropoffIds.has(d.id))];
      }

      let chemSets = get().chemSets;
      if (!chemSetsRes.error && chemSetsRes.data) {
        const remoteSets = chemSetsRes.data.map(dbToChemSet);
        const remoteSetIds = new Set(remoteSets.map((c) => c.id));
        chemSets = [...remoteSets, ...chemSets.filter((c) => !remoteSetIds.has(c.id))];
      }

      let batches = get().batches;
      if (!batchesRes.error && batchesRes.data) {
        const remoteBatches = batchesRes.data.map(dbToBatch);
        const remoteBatchIds = new Set(remoteBatches.map((b) => b.id));
        batches = [...remoteBatches, ...batches.filter((b) => !remoteBatchIds.has(b.id))];
      }

      set({
        purchases,
        dropoffs,
        chemSets,
        batches,
        cameras: [...DEFAULT_CAMERAS, ...customCameras],
        // Keep a process set on this device if the cloud doesn't have one (supabase/19 not run yet).
        filmStocks: [...DEFAULT_FILM_STOCKS, ...customStocks.map((f) =>
          f.process ? f : { ...f, process: get().filmStocks.find((x) => x.id === f.id)?.process })],
        journals,
        personalWalks,
        completions,
        myReviews,
      });
      get().persist();
    } catch (e) {
      console.error("syncFromSupabase failed:", e);
    }
  },

  uploadLocalToSupabase: async (userId) => {
    const { purchases, dropoffs, chemSets, batches, cameras, filmStocks, journals, personalWalks, completions, myReviews } = get();
    try {
      const customCameras = cameras.filter((c) => c.isCustom);
      const customStocks = filmStocks.filter((f) => f.isCustom);
      const publicWalks = personalWalks.filter((w) => w.isPublic);
      const allStops = publicWalks.flatMap((w) => w.stops.map((st) => walkStopToDb(st, userId)));

      const results = await Promise.all([
        purchases.length > 0
          ? supabase.from("film_purchases").upsert(purchases.map((p) => purchaseToDb(p, userId)))
          : Promise.resolve(),
        dropoffs.length > 0
          ? supabase.from("lab_dropoffs").upsert(dropoffs.map((d) => dropoffToDb(d, userId)))
          : Promise.resolve(),
        chemSets.length > 0
          ? supabase.from("chemical_sets").upsert(chemSets.map((c) => chemSetToDb(c, userId)))
          : Promise.resolve(),
        batches.length > 0
          ? supabase.from("dev_batches").upsert(batches.map((b) => batchToDb(b, userId)))
          : Promise.resolve(),
        customCameras.length > 0
          ? supabase.from("cameras").upsert(customCameras.map((c) => ({ id: c.id, user_id: userId, name: c.name })))
          : Promise.resolve(),
        customStocks.length > 0
          ? saveFilmStocks("upsert", customStocks, userId)
          : Promise.resolve(),
        journals.length > 0
          ? supabase.from("location_journals").upsert(journals.map((j) => journalToDb(j, userId)))
          : Promise.resolve(),
        publicWalks.length > 0
          ? supabase.from("walks").upsert(publicWalks.map((w) => walkToDb(w, userId)))
          : Promise.resolve(),
        allStops.length > 0
          ? supabase.from("walk_stops").upsert(allStops)
          : Promise.resolve(),
        completions.length > 0
          ? supabase.from("walk_completions").upsert(completions.map(completionToDb))
          : Promise.resolve(),
        myReviews.length > 0
          ? supabase.from("walk_reviews").upsert(myReviews.map(reviewToDb))
          : Promise.resolve(),
      ]);
      const tables = ["film_purchases", "lab_dropoffs", "chemical_sets", "dev_batches", "cameras", "film_stocks", "location_journals", "walks", "walk_stops", "walk_completions", "walk_reviews"];
      results.forEach((result, index) => {
        if (result?.error) console.error(`uploadLocalToSupabase ${tables[index]} failed:`, result.error);
      });
    } catch (e) {
      console.error("uploadLocalToSupabase failed:", e);
    }
  },

  // ── Local persistence ──────────────────────────────────────────────────────
  hydrate: async () => {
    try {
      const [rollsRaw, camerasRaw, stocksRaw, journalsRaw, walksRaw, completionsRaw, reviewsRaw, nudgesRaw, purchasesRaw, dropoffsRaw, chemSetsRaw, batchesRaw, preferencesRaw, syncRaw] = await Promise.all([
        AsyncStorage.getItem(KEYS.rolls),
        AsyncStorage.getItem(KEYS.cameras),
        AsyncStorage.getItem(KEYS.filmStocks),
        AsyncStorage.getItem(KEYS.journals),
        AsyncStorage.getItem(KEYS.personalWalks),
        AsyncStorage.getItem(KEYS.completions),
        AsyncStorage.getItem(KEYS.myReviews),
        AsyncStorage.getItem(KEYS.shownNudges),
        AsyncStorage.getItem(KEYS.purchases),
        AsyncStorage.getItem(KEYS.dropoffs),
        AsyncStorage.getItem(KEYS.chemSets),
        AsyncStorage.getItem(KEYS.batches),
        AsyncStorage.getItem(KEYS.preferences),
        AsyncStorage.getItem(KEYS.rollSyncMeta),
      ]);
      const syncSaved = syncRaw ? JSON.parse(syncRaw) as { owner: string | null; meta: SyncMeta } : null;
      const preferences = preferencesRaw ? JSON.parse(preferencesRaw) as Partial<{ temperatureUnit: TemperatureUnit; distanceUnit: DistanceUnit }> : {};
      set({
        rolls: rollsRaw ? (JSON.parse(rollsRaw) as Roll[]).map((r) => ({ ...r, status: normalizeStatus(r.status) })) : [],
        purchases: purchasesRaw ? JSON.parse(purchasesRaw) : [],
        dropoffs: dropoffsRaw ? JSON.parse(dropoffsRaw) : [],
        chemSets: chemSetsRaw ? JSON.parse(chemSetsRaw) : [],
        batches: batchesRaw ? JSON.parse(batchesRaw) : [],
        cameras: camerasRaw ? JSON.parse(camerasRaw) : DEFAULT_CAMERAS,
        filmStocks: stocksRaw ? withDefaultProcesses(JSON.parse(stocksRaw)) : DEFAULT_FILM_STOCKS,
        journals: journalsRaw ? JSON.parse(journalsRaw) : [],
        personalWalks: walksRaw ? JSON.parse(walksRaw) : [],
        completions: completionsRaw ? JSON.parse(completionsRaw) : [],
        myReviews: reviewsRaw ? JSON.parse(reviewsRaw) : [],
        shownProgressNudges: nudgesRaw ? JSON.parse(nudgesRaw) : [],
        temperatureUnit: preferences.temperatureUnit === "F" ? "F" : "C",
        distanceUnit: preferences.distanceUnit === "mi" ? "mi" : "km",
        rollSyncMeta: syncSaved?.meta ?? emptyMeta(),
        rollSyncOwner: syncSaved?.owner ?? null,
        hydrated: true,
      });
      get().backfillBatchDetails();
    } catch (e) {
      console.error("Hydration failed:", e);
      set({ hydrated: true });
    }
  },

  persist: async () => {
    const { rolls, purchases, dropoffs, chemSets, batches, cameras, filmStocks, journals, personalWalks, completions, myReviews, shownProgressNudges, temperatureUnit, distanceUnit } = get();
    try {
      await Promise.all([
        AsyncStorage.setItem(KEYS.rolls, JSON.stringify(rolls)),
        AsyncStorage.setItem(KEYS.dropoffs, JSON.stringify(dropoffs)),
        AsyncStorage.setItem(KEYS.chemSets, JSON.stringify(chemSets)),
        AsyncStorage.setItem(KEYS.batches, JSON.stringify(batches)),
        AsyncStorage.setItem(KEYS.purchases, JSON.stringify(purchases)),
        AsyncStorage.setItem(KEYS.cameras, JSON.stringify(cameras)),
        AsyncStorage.setItem(KEYS.filmStocks, JSON.stringify(filmStocks)),
        AsyncStorage.setItem(KEYS.journals, JSON.stringify(journals)),
        AsyncStorage.setItem(KEYS.personalWalks, JSON.stringify(personalWalks)),
        AsyncStorage.setItem(KEYS.completions, JSON.stringify(completions)),
        AsyncStorage.setItem(KEYS.myReviews, JSON.stringify(myReviews)),
        AsyncStorage.setItem(KEYS.shownNudges, JSON.stringify(shownProgressNudges)),
        AsyncStorage.setItem(KEYS.preferences, JSON.stringify({ temperatureUnit, distanceUnit })),
      ]);
    } catch (e) {
      console.error("Persist failed:", e);
    }
  },
}));
