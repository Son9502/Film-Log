# Film Log

A mobile-first app for film photographers to track rolls, log individual exposures, manage gear, and import scans — with cloud sync across devices via Supabase.

> **Upgrading from the paused build?** Run `supabase/13`–`18` (see [Supabase Setup](#supabase-setup)), then reload the web app and restart Expo Go on every device. Rolls and frames then sync with conflict protection; Settings → Sync shows status and anything that needs your choice.

---

## Features

- **Roll tracking** — log every roll from purchase through development across the statuses Shooting → To Develop → In Development / In Lab → In Scanning → Archived
- **Roll names** — optional names are labels, not identifiers. The app warns about an existing name (ignoring case and surrounding spaces) when creating or editing a roll, but allows separate rolls to share it. The warning reflects rolls currently on the device; it is not a cloud-wide uniqueness guarantee.
- **Frame logging** — record shutter speed, aperture, lighting condition, subject, notes, location, timestamp, flash used, filter (UV/polarizer/ND/colour), weather condition, star rating, and free-form tags per frame
- **Quick log** — tap ⚡ to instantly log a frame with GPS only; fill in the rest after developing
- **Development records** — track developer, dilution, dev time, dev temperature, push/pull stops, fixer, and Photo-Flo per roll
- **Scan attachment** — attach a scan to a frame, or bulk-import a ZIP or a photo selection; files go to the Supabase `scans` bucket.
- **Backfill scans** — when an import has more photos than logged frames, the missing frames are created for you.
- **Scan import progress** — bulk uploads show the current file, elapsed wait, number of scans processed, and any failures; the bar advances per file, not by transferred bytes. Elapsed time does not confirm the connection is active. Keep the import screen open and verify the frame attachments on another device before deleting originals.
- **Scan import filenames** — selected files with matching names are assigned independently. On native, ZIP images in different folders can have the same basename without overwriting each other.
- **Film strip view** — visualise a roll as a film negative strip with sprocket holes; portrait scans rotate 90° clockwise to fit the landscape strip, while landscape and square scans stay upright. Images fit without cropping. The rotation is only a strip preview; saved scans and the opened image are unchanged. Tap any frame to open it.
- **Scan preview orientation** — the frame editor sizes the preview using the loaded image's dimensions; portrait, square and landscape scans fit without cropping. Rotation controls are temporary preview adjustments and do not modify saved scans or exports.
- **GPS & location** — auto-captures GPS coordinates when logging a frame (if permitted); manual text location with geocoding (address → lat/lng); Shot Map (a Map view on the Journal tab) pins all frames on a map
- **Location journals** — every unique location label becomes a journal entry: write notes about the place, browse all frames shot there in a chronological timeline; serves as a living trip report
- **Gear management** — manage cameras and film stocks; 17 stocks and 3 cameras included by default, add your own
- **Film inventory** — log film purchases (stock, quantity, price, expiry), see what is expired, and load a roll straight from the inventory
- **Lab drop-offs** — drop several rolls at a lab at once, choosing per roll whether the lab develops, scans or both; record cost and pick-up
- **Development calculator** — times for B&W (38 developer/film recipes), C-41, E-6 and ECN-2, with push/pull, temperature compensation and a step-by-step process list; save the result to a roll
- **Chemical sets & batches** — on the Develop tab, track shelf life and capacity of mixed chemistry and develop a batch of rolls at once; the app suggests the time per roll and blocks mixes that can't share a tank (remjet with non-remjet, different processes, different push/pull)
- **Scan backup check** — checks whether attached cloud scans respond to a HEAD request. Before deleting originals, export the scans and open the downloaded files to verify their contents; the check alone does not download them.
- **Search & filters** — search rolls by name, film, camera and notes; filter by status, film stock, camera, location and date range
- **Stats card & export** — this-month and all-time rolls, frames, most-shot stocks and spending; export rolls and frames to CSV, plus scan ZIPs with JPEG EXIF metadata
- **Local snapshot export** — Settings or the signed-out login screen can export the current device's local data as JSON for safekeeping before sync changes. It may contain private notes, locations and account ID; keep it private. The snapshot contains scan references, not image files, and there is no in-app restore yet. Export scans separately and verify both files. Repeat on each device because their local data may differ.
- **Conflict-safe roll sync** — rolls and frames sync between phone and web. Edits to different fields on two devices merge automatically; the same field changed differently on both is held back until you choose in Settings → Sync. Deletions sync too, and a roll changed elsewhere after you deleted it is restored instead of lost.
- **Units** — choose °C/°F and km/mi; values are stored in Celsius and kilometers
- **Stats & badges** — overview dashboard (rolls, frames, stocks, cameras, locations); badge system for milestones and achievements
- **Cloud sync** — rolls and frames use revision-checked sync (above); other data (inventory, drop-offs, chemical sets, batches, gear, journals) uses simple last-write-wins sync.
- **Password security** — signup enforces min 8 chars, uppercase, number, and symbol with a live strength indicator; forgot/reset password flow via email link
- **Web + mobile** — runs in browser (Expo web) and on iOS/Android

---

## Tech Stack

| Layer | Tool |
|---|---|
| Framework | React Native + Expo SDK 58 |
| Routing | Expo Router (file-based) |
| Language | TypeScript |
| State | Zustand + AsyncStorage (offline-first) |
| Backend | Supabase (auth, PostgreSQL, storage) |
| Maps | react-native-maps |
| Location | expo-location + Nominatim (web geocoding) |
| Zip import | fflate (web and native) |

---

## Getting Started

### 1. Install dependencies

```bash
cd filmlog
npm install
```

### 2. Add Supabase credentials

Copy the example env file and fill in your project values (Supabase Dashboard → Project Settings → API):

```bash
cp .env.example .env
```

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-publishable-or-anon-key
```

`.env` is gitignored. Only use the **publishable / anon** key here: `EXPO_PUBLIC_*` values are bundled into the client, and Row Level Security is what protects the data. Never use the `service_role` key.

### 3. Run

```bash
npm run web        # browser
npm start          # Expo dev menu — press w for web, i for iOS, a for Android
```

If you change `.env`, restart with a cleared cache: `npx expo start -c`.

> See [ARCHITECTURE.md](ARCHITECTURE.md) for how the app is structured, how offline sync works, and known limitations.

---

## Supabase Setup

Run everything below in Supabase Dashboard → SQL Editor, **in this order**:

1. **Database tables**, **RLS**, and **Storage bucket** sections below (base schema)
2. [`supabase/01_walks.sql`](supabase/01_walks.sql): walk tables, RLS, Realtime, counter RPCs
3. [`supabase/02_realtime_creator_notifications.sql`](supabase/02_realtime_creator_notifications.sql)
4. [`supabase/03_walk_edit_policies.sql`](supabase/03_walk_edit_policies.sql)
5. [`supabase/04_roll_visibility.sql`](supabase/04_roll_visibility.sql)
6. [`supabase/05_profiles_avatars.sql`](supabase/05_profiles_avatars.sql): profiles table + public `avatars` bucket
7. [`supabase/06_security_hardening.sql`](supabase/06_security_hardening.sql): private profiles, walk policy cleanup, counter triggers (required)
8. [`supabase/07_film_purchases.sql`](supabase/07_film_purchases.sql): film inventory
9. [`supabase/08_lab_dropoffs.sql`](supabase/08_lab_dropoffs.sql): lab drop-offs and roll status details
10. [`supabase/09_scan_backup.sql`](supabase/09_scan_backup.sql): scan backup confirmation
11. [`supabase/10_chemical_sets_batches.sql`](supabase/10_chemical_sets_batches.sql): chemical sets and development batches
12. [`supabase/11_roll_realtime.sql`](supabase/11_roll_realtime.sql): Realtime notifications for new rolls
13. [`supabase/12_shot_metadata_columns.sql`](supabase/12_shot_metadata_columns.sql): ensure optional frame metadata columns exist
14. [`supabase/13_roll_revision_tracking.sql`](supabase/13_roll_revision_tracking.sql), [`14_guarded_roll_writes.sql`](supabase/14_guarded_roll_writes.sql) and [`15_guarded_deletions.sql`](supabase/15_guarded_deletions.sql): conflict-safe roll/frame sync (run all three, in order)
15. [`supabase/16_location_journals.sql`](supabase/16_location_journals.sql): location journals table
16. [`supabase/17_batch_details.sql`](supabase/17_batch_details.sql): fixer, wetting agent and solution volume on batches; minimum concentrate on chemical sets
17. [`supabase/18_frame_realtime.sql`](supabase/18_frame_realtime.sql): live frame updates across devices
18. [`supabase/19_film_stock_process.sql`](supabase/19_film_stock_process.sql): development process (B&W, C-41, E-6, ECN-2) on custom film stocks

On a fresh project, skip the *Phase 8* walk block in **Migrations** and the walk policies in **RLS**: `01_walks.sql` replaces them with stricter policies. See [ARCHITECTURE.md §8](ARCHITECTURE.md#8-security-model--known-limitations).

### Roll sync

Rolls and frames sync through revision-checked database functions instead of direct table writes:

- Every roll and frame row has a `sync_revision` that the database bumps on each write (13).
- Clients can't write `rolls`/`shots` directly. They call `guarded_roll_write` / `guarded_shot_write`, which only save if the caller's expected revision still matches (14). An out-of-date app gets a permission error instead of overwriting newer data, so reload every device after running 14.
- Deletes are revision-checked too, and leave hidden tombstones so other devices learn about them (15).

The app keeps, per roll and frame, the cloud version it last synced. It pushes only what changed locally and merges cloud changes field by field (see `src/utils/rollMerge.ts`). The first sync after upgrading compares each device's copy with the cloud: values missing on one side are filled from the other, and real differences appear in Settings → Sync for you to choose. Back up the database (or export a local snapshot on each device) before running 13–15.

SQL tests for 13–15 are in [`supabase/tests/`](supabase/tests/). They need a disposable project with two users and roll back their changes.

### Database tables

```sql
create table rolls (
  id text primary key,
  user_id uuid references auth.users not null,
  name text,
  film_stock_id text not null,
  camera_id text not null,
  iso text not null,
  frame_count integer not null,
  status text not null,
  loaded_at text not null,
  lab_at text,
  developed_at text,
  notes text,
  location_label text,
  developer text,
  dilution text,
  dev_time text,
  dev_temp text,
  push_pull text,
  fixer text,
  photo_flo boolean,
  created_at text not null,
  updated_at text not null
);

create table shots (
  id text primary key,
  roll_id text references rolls not null,
  user_id uuid references auth.users not null,
  frame integer not null,
  shutter text,
  aperture text,
  lighting text,
  subject text,
  notes text,
  location_label text,
  latitude double precision,
  longitude double precision,
  scan_uri text,
  timestamp text,
  flash boolean,
  filter text,
  weather text,
  rating integer,
  tags text
);

create table cameras (
  id text primary key,
  user_id uuid references auth.users not null,
  name text not null
);

create table film_stocks (
  id text primary key,
  user_id uuid references auth.users not null,
  name text not null,
  iso integer not null
);

create table location_journals (
  id text primary key,
  user_id uuid references auth.users not null,
  location_label text not null,
  body text,
  latitude double precision,
  longitude double precision,
  created_at text not null,
  updated_at text not null
);
```

### Migrations (if tables already exist)

```sql
-- Phase 5: frame metadata + dev details
alter table shots add column if not exists timestamp text;
alter table shots add column if not exists flash boolean;
alter table shots add column if not exists filter text;
alter table shots add column if not exists weather text;
alter table rolls add column if not exists developer text;
alter table rolls add column if not exists dilution text;
alter table rolls add column if not exists dev_time text;
alter table rolls add column if not exists dev_temp text;

-- Phase 5 additions: push/pull, fixer, Photo-Flo
alter table rolls add column if not exists push_pull text;
alter table rolls add column if not exists fixer text;
alter table rolls add column if not exists photo_flo boolean;

-- Phase 6: location journals
create table if not exists location_journals (
  id text primary key,
  user_id uuid references auth.users not null,
  location_label text not null,
  body text,
  latitude double precision,
  longitude double precision,
  created_at text not null,
  updated_at text not null
);

-- Phase 7: star ratings + tags
alter table shots add column if not exists rating integer;
alter table shots add column if not exists tags text;

-- Phase 8: photo / art walks
create table if not exists walks (
  id text primary key,
  title text not null,
  description text,
  city text,
  tags text,
  estimated_minutes integer,
  distance_km double precision,
  difficulty text,
  is_public boolean not null default false,
  is_featured boolean not null default false,
  created_by_user_id uuid references auth.users,
  completion_count integer not null default 0,
  avg_rating double precision,
  created_at text not null,
  updated_at text not null
);

create table if not exists walk_stops (
  id text primary key,
  walk_id text references walks not null,
  user_id uuid references auth.users not null,
  order_index integer not null,
  title text not null,
  description text,
  location_label text,
  latitude double precision,
  longitude double precision
);

create table if not exists walk_completions (
  id text primary key,
  walk_id text references walks not null,
  user_id uuid references auth.users not null,
  completed_at text not null
);

create table if not exists walk_reviews (
  id text primary key,
  walk_id text references walks not null,
  user_id uuid references auth.users not null,
  rating integer not null,
  body text,
  created_at text not null
);

-- Helper RPCs used by the app to keep denormalized counts in sync
create or replace function increment_walk_completion(walk_id text)
returns void language sql as $$
  update walks set completion_count = completion_count + 1 where id = walk_id;
$$;

create or replace function decrement_walk_completion(walk_id text)
returns void language sql as $$
  update walks set completion_count = greatest(0, completion_count - 1) where id = walk_id;
$$;

create or replace function refresh_walk_avg_rating(walk_id text)
returns void language sql as $$
  update walks set avg_rating = (
    select avg(rating)::double precision from walk_reviews where walk_reviews.walk_id = walks.id
  ) where id = walk_id;
$$;
```

### Row Level Security (RLS)

```sql
alter table rolls             enable row level security;
alter table shots             enable row level security;
alter table cameras           enable row level security;
alter table film_stocks       enable row level security;
alter table location_journals enable row level security;
alter table walks             enable row level security;
alter table walk_stops        enable row level security;
alter table walk_completions  enable row level security;
alter table walk_reviews      enable row level security;

create policy "own rows" on rolls             for all using (auth.uid() = user_id);
create policy "own rows" on shots             for all using (auth.uid() = user_id);
create policy "own rows" on cameras          for all using (auth.uid() = user_id);
create policy "own rows" on film_stocks      for all using (auth.uid() = user_id);
create policy "own rows" on location_journals for all using (auth.uid() = user_id);

-- Walks: owners can do anything; anyone can read public walks
create policy "own walks"    on walks for all    using (auth.uid() = created_by_user_id);
create policy "read public"  on walks for select using (is_public = true);
create policy "own stops"    on walk_stops for all    using (auth.uid() = user_id);
create policy "read pub stops" on walk_stops for select using (
  exists (select 1 from walks where walks.id = walk_stops.walk_id and walks.is_public = true)
);
create policy "own completions" on walk_completions for all using (auth.uid() = user_id);
create policy "own reviews"     on walk_reviews for all    using (auth.uid() = user_id);
create policy "read reviews"    on walk_reviews for select using (true);
```

### Storage bucket

1. Supabase Dashboard → Storage → New bucket
2. Name: `scans`, set to **Private**
3. Add RLS policies:

```sql
create policy "upload own scans" on storage.objects
  for insert with check (
    bucket_id = 'scans' and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "read own scans" on storage.objects
  for select using (
    bucket_id = 'scans' and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "delete own scans" on storage.objects
  for delete using (
    bucket_id = 'scans' and auth.uid()::text = (storage.foldername(name))[1]
  );
```

Scans are stored at `{userId}/{rollId}/{shotId}.{ext}` and served via signed URLs (1-hour expiry).

---

## Project Structure

```
filmlog/
├── app/
│   ├── (tabs)/
│   │   ├── index.tsx           # Rolls list (home)
│   │   ├── inventory.tsx       # Film Stash (inventory)
│   │   ├── develop.tsx         # Develop tab: chemical sets, batches, calculator link
│   │   ├── journal.tsx         # Location journals tab (List / Map toggle)
│   │   ├── walks.tsx           # Photo walks tab (My / Community / Recommended)
│   │   └── settings.tsx        # Settings tab
│   ├── calculator.tsx          # Development calculator
│   ├── batch/
│   │   └── new.tsx             # Develop a batch of rolls
│   ├── auth/
│   │   ├── login.tsx           # Sign in + forgot password
│   │   ├── signup.tsx          # Create account
│   │   └── reset-password.tsx  # Password reset (deep-linked from email)
│   ├── journal/
│   │   └── [label].tsx         # Location journal detail + frame timeline
│   ├── walks/
│   │   ├── [id].tsx            # Walk detail — stops, completion, review
│   │   └── new.tsx             # Create / edit walk with stop builder
│   ├── roll/
│   │   ├── [id].tsx            # Roll detail, frame list, scan attachment, film strip, shot map
│   │   ├── new.tsx             # New roll form
│   │   ├── import.tsx          # ZIP scan import (iOS/Android)
│   │   └── import.web.tsx      # ZIP scan import (web, uses fflate)
│   ├── profile/
│   │   └── [userId].tsx        # Public photographer profile
│   ├── settings/
│   │   ├── gear.tsx            # Camera + film stock management
│   │   ├── profile.tsx         # Edit handle, display name, bio, avatar, visibility
│   │   └── stats.tsx           # Stats dashboard + badges
│   └── _layout.tsx             # Root layout, session bootstrap, auth gate, Realtime
├── src/
│   ├── components/
│   │   ├── BadgeToast.tsx      # Badge / notification toasts
│   │   ├── Dropdown.tsx        # Shared dropdown
│   │   ├── LabDropoffModal.tsx # Lab drop-off form
│   │   └── ShotMap.tsx         # Map of shot locations
│   ├── constants/              # COLORS theme, default gear, film stocks, filter/weather options, badges
│   ├── mocks/                  # Web stubs for native-only packages
│   ├── services/
│   │   └── supabase.ts         # Supabase client, auth helpers, storage helpers
│   ├── store/
│   │   └── index.ts            # Zustand store (rolls, shots, gear, journals, walks, profiles, sync)
│   ├── types/
│   │   └── index.ts            # TypeScript interfaces
│   └── utils/
│       ├── index.ts            # uid, formatDate, rollProgress, validators
│       ├── badges.ts           # Badge stats + notification engine
│       ├── devCalc.ts          # Development time calculator
│       ├── chemistry.ts        # Shelf-life/capacity checks, batch mapping
│       ├── summary.ts          # This-month / all-time stats
│       ├── rollFilter.ts       # Roll search and filters
│       ├── exportCsv.ts        # Roll/frame CSV export
│       ├── exportFiles.ts      # Platform-specific save/share helpers
│       ├── exportZip.ts        # Scan archive and JPEG EXIF metadata
│       └── units.ts            # Metric storage and display conversions
├── supabase/                   # Incremental SQL scripts (run in numeric order)
├── metro.config.js             # Stubs react-native-maps on web
├── .env.example                # Required environment variables
├── ARCHITECTURE.md             # System design & data flow
└── package.json
```

---

## Default Gear

### Cameras
Nikon FE · Nikon L35AD2 · Other

### Film Stocks (17 included)
Kodak Portra 160/400/800, Gold 200, ColorPlus 200, Ektar 100, UltraMax 400, Tri-X 400
Fuji Superia 400, Pro 400H, Velvia 50, Provia 100F
Ilford HP5 Plus, Delta 100, Delta 3200, FP4 Plus
Rollei RPX 400

Custom cameras and stocks can be added per-user and sync to Supabase.

---

## Roadmap

> **v1 target:** see [MVP.md](MVP.md) for the v1 scope (development workflow, inventory, lab drop-offs, mobile), what is built so far, and the build order.

| Phase | Status | Description |
|---|---|---|
| 1 — Core UI | ✅ Done | Rolls, frames, gear, five-status workflow, navigation |
| 2 — Auth & Sync | ✅ Done | Supabase auth, cloud sync, offline-first, forgot/reset password |
| 3 — Scans | ✅ Done | Per-frame scan attachment, ZIP bulk import, film strip view |
| 4 — GPS & Location | ✅ Done | Auto-GPS on frame log, per-roll Shot Map, manual location labels on rolls and frames, text-to-coords geocoding |
| 5 — Frame Metadata | ✅ Done | Per-frame timestamp, flash, filter (UV/polarizer/ND/colour), weather condition; development details (developer, dilution, time, temperature, push/pull, fixer, Photo-Flo); quick-log ⚡ FAB |
| 6 — Location Journals | ✅ Done | Location tab grouping all shot places; per-location notes editor; chronological frame timeline per location; full Supabase sync |
| 7 — Gamification | ✅ Done | Star ratings (1–5) and free-form tags per frame; stats dashboard with 15 metrics; badge system with 28 achievements across volume, craft, darkroom, scanning, and rating categories |
| 8 — Photo / Art Walks | ✅ Done | Curated walking routes for photographers: personal walks (private, saved to profile), community walks (public, discoverable by city), and recommended/featured walks; stop-by-stop waypoints with location description and shooting tips; completion tracking; star ratings and short reviews; Shot Map overlay showing the walk route; auto-link stops to Location Journals; 4 new walk-specific badges (First Walk, Walker ×5, Trail Blazer, Walk Critic) |
| 9 — Public Profiles | 🚧 In progress | Opt-in public photographer profile. **Done:** handle, display name, bio, avatar upload, public/private toggle, public rolls, public walks (`supabase/04`, `05`). **Remaining:** badges and stats on the profile, completed walks, curated favourite shots, full technical cards per frame |
| 10 — AI Film Advisor | 🔜 Planned | Context-aware chatbot using the user's roll history: stock recommendations, exposure guidance, home dev walkthrough, pattern analysis, troubleshooting |
| 11 — Sharing & Export | 🚧 In progress | **Done:** CSV export of rolls and frames; ZIP export of scans with JPEG EXIF metadata. **Remaining:** share journals, rolls and shots via share sheet |
| Auth Polish | 🔜 Planned | Google/Yahoo OAuth, custom Supabase email templates |

---

## Developer Notes

- All domain types live in `src/types/index.ts` — add there first
- Store actions follow the pattern: update local state → `persist()` → background Supabase write
- Frame count reductions must go through `validateFrameCountChange()` in `src/utils/index.ts`
- Only the last logged frame can be deleted (film can't be un-exposed)
- `Alert.alert` does not work on web — use inline confirm state pattern instead
- Calculator reference data in `src/constants/devData.generated.ts` is generated from a workbook; edit the generator, not the file
- Run the unit tests with `npm test`
- `react-native-maps` is stubbed on web via `metro.config.js`
- Supabase processes password-reset tokens before React mounts on web — the reset screen uses both `getSession()` and `onAuthStateChange` in parallel to handle the race condition
- Tags stored in DB as JSON string (`text` column); parse on hydration with try/catch guard
- Badges are computed client-side from store data — no DB table required
- Supabase config is read from `.env` (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`); the app throws a clear error at startup if either is missing
- New schema changes go in a new numbered file under `supabase/`
