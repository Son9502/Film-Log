// ── Roll and frame DB mappers (camelCase ↔ snake_case) ───────────────────────
import { normalizeStatus } from "@/constants";
import type { Roll, Shot } from "@/types";

export function rollToDb(roll: Roll, userId: string) {
  return {
    id: roll.id,
    user_id: userId,
    name: roll.name ?? null,
    film_stock_id: roll.filmStockId,
    camera_id: roll.cameraId,
    iso: roll.iso,
    frame_count: roll.frameCount,
    status: roll.status,
    loaded_at: roll.loadedAt,
    lab_at: roll.labAt ?? null,
    lab_dropoff_id: roll.labDropoffId ?? null,
    backed_up_at: roll.backedUpAt ?? null,
    backed_up_count: roll.backedUpCount ?? null,
    developed_at: roll.developedAt ?? null,
    notes: roll.notes ?? null,
    location_label: roll.locationLabel ?? null,
    developer: roll.developer ?? null,
    dilution: roll.dilution ?? null,
    dev_time: roll.devTime ?? null,
    dev_temp: roll.devTemp ?? null,
    push_pull: roll.pushPull ?? null,
    fixer: roll.fixer ?? null,
    photo_flo: roll.photoFlo ?? null,
    expires_at: roll.expiresAt ?? null,
    expiry_comp_stops: roll.expiryCompStops || null, // 0 and unset are the same
    is_public: roll.isPublic ?? false,
    created_at: roll.createdAt,
    updated_at: roll.updatedAt,
  };
}

export function dbToRoll(row: any): Roll {
  return {
    id: row.id,
    name: row.name ?? undefined,
    filmStockId: row.film_stock_id,
    cameraId: row.camera_id,
    iso: row.iso,
    frameCount: row.frame_count,
    status: normalizeStatus(row.status),
    loadedAt: row.loaded_at,
    labAt: row.lab_at ?? undefined,
    labDropoffId: row.lab_dropoff_id ?? undefined,
    backedUpAt: row.backed_up_at ?? undefined,
    backedUpCount: row.backed_up_count ?? undefined,
    developedAt: row.developed_at ?? undefined,
    notes: row.notes ?? undefined,
    locationLabel: row.location_label ?? undefined,
    // Supabase returns nested shots in no fixed order, so sort them by frame.
    shots: (row.shots ?? []).map(dbToShot).sort((a: Shot, b: Shot) => a.frame - b.frame),
    userId: row.user_id,
    developer: row.developer ?? undefined,
    dilution: row.dilution ?? undefined,
    devTime: row.dev_time ?? undefined,
    devTemp: row.dev_temp ?? undefined,
    pushPull: row.push_pull ?? undefined,
    fixer: row.fixer ?? undefined,
    photoFlo: row.photo_flo ?? undefined,
    expiresAt: row.expires_at ?? undefined,
    // PostgREST may return numeric as a string.
    expiryCompStops: row.expiry_comp_stops != null && Number(row.expiry_comp_stops) !== 0
      ? Number(row.expiry_comp_stops) : undefined,
    isPublic: row.is_public ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function shotToDb(shot: Shot, rollId: string, userId: string) {
  return {
    id: shot.id,
    roll_id: rollId,
    user_id: userId,
    frame: shot.frame,
    shutter: shot.shutter ?? null,
    aperture: shot.aperture ?? null,
    lighting: shot.lighting ?? null,
    subject: shot.subject ?? null,
    notes: shot.notes ?? null,
    scan_uri: shot.scanUri ?? null,
    location_label: shot.locationLabel ?? null,
    latitude: shot.location?.latitude ?? null,
    longitude: shot.location?.longitude ?? null,
    timestamp: shot.timestamp ?? null,
    flash: shot.flash ?? null,
    filter: shot.filter ?? null,
    weather: shot.weather ?? null,
    rating: shot.rating ?? null,
    tags: shot.tags ? JSON.stringify(shot.tags) : null,
  };
}

export function dbToShot(row: any): Shot {
  return {
    id: row.id,
    frame: row.frame,
    shutter: row.shutter ?? undefined,
    aperture: row.aperture ?? undefined,
    lighting: row.lighting ?? undefined,
    subject: row.subject ?? undefined,
    notes: row.notes ?? undefined,
    locationLabel: row.location_label ?? undefined,
    scanUri: row.scan_uri ?? undefined,
    timestamp: row.timestamp ?? undefined,
    flash: row.flash ?? undefined,
    filter: row.filter ?? undefined,
    weather: row.weather ?? undefined,
    rating: row.rating ?? undefined,
    tags: (() => { try { return row.tags ? JSON.parse(row.tags) : undefined; } catch { return undefined; } })(),
    location: row.latitude != null && row.longitude != null ? {
      latitude: row.latitude,
      longitude: row.longitude,
    } : undefined,
  };
}

// ── Sync field sets ───────────────────────────────────────────────────────────
// Exactly the columns guarded_roll_write / guarded_shot_write accept (supabase/14).

export type SyncFields = Record<string, string | number | boolean | null>;

export function rollSyncFields(roll: Roll): SyncFields {
  const { id: _id, user_id: _user, ...fields } = rollToDb(roll, "");
  return fields as SyncFields;
}

export function shotSyncFields(shot: Shot): SyncFields {
  const { id: _id, roll_id: _roll, user_id: _user, ...fields } = shotToDb(shot, "", "");
  return fields as SyncFields;
}

/** Rebuilds a roll from synced fields, keeping local-only properties (shots, GPS, owner). */
export function rollFromSyncFields(id: string, fields: SyncFields, keep?: Roll): Roll {
  const mapped = dbToRoll({ ...fields, id });
  return { ...keep, ...mapped, shots: keep?.shots ?? [], location: keep?.location, userId: keep?.userId };
}

export function shotFromSyncFields(id: string, fields: SyncFields, keep?: Shot): Shot {
  const mapped = dbToShot({ ...fields, id });
  // Keep a local place label on the GPS point when the coordinates are unchanged.
  const label = keep?.location && mapped.location &&
    keep.location.latitude === mapped.location.latitude && keep.location.longitude === mapped.location.longitude
    ? keep.location.label : undefined;
  return { ...mapped, location: mapped.location ? { ...mapped.location, ...(label ? { label } : {}) } : undefined };
}
