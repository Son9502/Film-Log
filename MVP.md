# Film Log — v1 scope

**One line:** Film Log follows a roll of film through its whole life: buying it, loading it, shooting it, developing it (at home or at a lab), scanning it, and archiving the scans in the cloud. It runs on the web and on a phone, synced through Supabase.

This document defines **v1**. For the feature list and setup, see [README.md](README.md). For how the code is structured, see [ARCHITECTURE.md](ARCHITECTURE.md).

v1 changes direction from the earlier plan. Social features (walks, public profiles, badges) are already built and stay in the app, but no new work goes into them until v2. The new v1 work is the development workflow: reference data, a development calculator, chemical tracking and batches. v1 also has to run on a phone, not only on the web.

---

## 1. Status at a glance

_Last reviewed: 2026-11-10._

| Area | Status |
|---|---|
| Rolls and frames: film stock, camera, ISO shot at, dates | ✅ Built |
| Notes per roll and per frame (settings, location, development fields) | ✅ Built |
| Bulk scan import from a ZIP | ✅ Built (web); native import needs rework (see §4) |
| Gallery by roll and shot locations | ✅ Built (on web, the shot map is a list grouped by roll) |
| Scans uploaded to cloud storage | ✅ Built (Supabase `scans` bucket) |
| New status flow with lab drop-offs | ✅ Built (`supabase/08_lab_dropoffs.sql`) |
| Scan backup check | 🟡 Checks cloud availability; export and open scans to verify their contents before deleting originals |
| Reference data, development calculator, step-by-step instructions | ✅ Built (B&W, C-41, E-6, ECN-2; data from a workbook, push curves compared with Digitaltruth guidance) |
| Chemical sets and batches | ✅ Built (`supabase/10`, `17`): batches record fixer, wetting agent, per-roll push/pull and a mix helper; sets list the rolls they developed |
| Film inventory | ✅ Built (`supabase/07_film_purchases.sql`) |
| Stats card (this month, most-shot stocks, spending) | ✅ Built (top of the stats page, this month / all time) |
| Search and filters | ✅ Built (Rolls tab) |
| Data export | ✅ CSV of rolls and frames; ZIP of scans with JPEG EXIF metadata |
| Units setting | ✅ °C/°F and km/mi preferences; values stored in metric |
| Expired-film flag | ✅ Built (Film Stash tab) |
| Mobile build tested on a phone | 🟡 Runs in Expo Go; flows to re-test now that sync is back (§4) |
| Database security fixes | 🟡 Script written (`supabase/06_security_hardening.sql`); run it in Supabase and re-test walks and profiles |
| Phone ↔ web sync | ✅ Conflict-safe roll/frame sync (`supabase/13`–`15`, `18`); run the scripts to turn it on |
| Automated tests | ✅ Jest (`npm test`): calculator, chemistry, summary, filters, CSV |
| Public deployment | ❌ Not deployed |
| Public GitHub repo | ✅ Created |

---

## 2. Roll status flow

A roll moves through these statuses (a To Develop buffer sits between shooting and development):

**Shooting → To Develop → In Development → In Lab → In Scanning → Archived**

Not every roll visits every status. Which ones it visits depends on whether you develop and scan it yourself or hand it to a lab:

| Develop | Scan | Path |
|---|---|---|
| Me | Me | Shooting → In Development → In Scanning → Archived |
| Lab | Me | Shooting → In Lab → In Scanning → Archived |
| Me | Lab | Shooting → In Development → In Lab → Archived |
| Lab | Lab | Shooting → In Lab → Archived |

**How rolls move:**

- **Finish a roll yourself:** from Shooting, "Develop it myself" moves the roll to In Development, where it waits to be added to a batch.
- **Drop off at a lab:** a lab drop-off screen lists rolls that are Shooting or In Development. You tick the rolls you're dropping off, and for each one tick **Develop** and/or **Scan**. Those rolls move to In Lab. A drop-off records the lab's name, the date and, optionally, the cost.
- **Finish a batch:** every roll in the batch moves from In Development to In Scanning.
- **Pick up from the lab:** marking a drop-off as picked up moves rolls the lab only developed to In Scanning. Rolls the lab also scanned move to Archived once their scans are imported.
- **Finish scanning:** after importing scans, "Mark as archived" moves a roll from In Scanning to Archived.

Unshot film no longer counts as a roll. It lives in the inventory (§3.4), and loading film from the inventory creates a roll in Shooting.

**Migrating existing data:** Stock rolls become inventory entries, At Lab becomes In Lab (with the lab developing), Developed becomes In Scanning, and Shooting and Archived stay as they are. The old statuses are referenced in about 17 places across `src/types`, `src/constants`, `src/utils`, `app/(tabs)/index.tsx`, `app/roll/new.tsx` and `app/roll/[id].tsx`, and badges that count statuses need checking too.

---

## 3. v1 features

### 3.1 Core tracking

- ✅ Rolls and frames: film stock, camera, ISO shot at, dates.
- ✅ Notes per roll (including development details) and per frame (settings, location).
- ✅ Bulk scan import from a ZIP.
- ✅ Gallery by roll, with GPS shot locations.
- The new status flow and lab drop-offs from §2.

### 3.2 Storage

- ✅ Scans upload to cloud storage.
- **Scan backup check:** the app checks whether attached cloud scans respond to a HEAD request and shows a "backed up" badge. This does not verify scan contents or ensure every original is attached. Export the scans and open them before deleting local originals.

### 3.3 Development

- **Reference data:** film stocks (including whether they have a remjet backing), developers and kits, recipes, and process steps (§6). Seed only the stocks and developers you actually use, about 5–10 recipes, entered by hand from the manufacturers' datasheets. Don't scrape third-party charts such as the Massive Dev Chart; their data is copyrighted.
- **Development calculator:** given a stock, developer, dilution, the ISO it was shot at and the temperature, it works out the development time from:
  - the base time in the matching recipe;
  - push and pull, from the recipe for that ISO if there is one, otherwise from a per-stop adjustment;
  - temperature, using the compensation chart for that process (B&W uses a time and temperature chart such as Ilford's; C-41 uses fixed time and temperature pairs);
  - exhaustion, extending the time according to how many rolls the chemical set has already developed.
- **Step-by-step instructions:** the steps for the process (for example remjet removal, develop, stop, fix, wash), each showing its calculated time, temperature and agitation. Remjet removal only appears for stocks that have remjet. There's no in-app timer in v1.
- **Chemical sets:** developer or kit, dilution, volume, date mixed and rolls developed. A set warns when it is past its shelf life or has reached its capacity.
- **Batches:** add rolls that are In Development to a batch and choose a chemical set. The batch saves the actual time and temperature used. Finishing a batch moves every roll to In Scanning and adds the roll count to the chemical set.

### 3.4 Inventory and insights

- **Film inventory:** purchases with stock, quantity, price, purchase date and expiry date. "Load a roll" takes one from the inventory and creates a roll in Shooting.
- **Expired-film flag:** the inventory warns when a stock is past its expiry date, and loading expired film shows a reminder that expired film usually needs extra exposure.
- **Stats card:** rolls this month, most-shot stocks, and spending (film purchases plus lab costs).

### 3.5 Usability

- **Search and filters:** filter rolls by film stock, camera, date range, status and location, and search by roll name.
- **Data export:** a CSV of rolls and frames, plus a ZIP of the original scans per roll. Exported JPEGs include frame metadata in EXIF; TIFFs stay unchanged. This is required before "safe to delete locally" means anything.
- **Photo metadata on export:** exported JPEG scans get the frame's details written into their EXIF data: camera, ISO, shutter speed, aperture, date shot and GPS, with the film stock and roll name in the image description. Scans in cloud storage stay untouched; metadata is only added to the exported copies. TIFF files are exported without it.
- **Units:** °C or °F, and kilometers or miles. Values are stored in Celsius/kilometers and converted for display.

---

## 4. Mobile

v1 must work on a phone, with changes syncing to the web. The code is shared, but the mobile build has never been run.

**Steps:**

1. ✅ **Fix the dependency versions.** Every package now matches Expo SDK 58 (React 19, React Native 0.88, `expo-router` 58), and `npm install` works without `--legacy-peer-deps`.
2. ✅ **Remove packages that block Expo Go.** Native ZIP import now uses `fflate` with the new `expo-file-system` API instead of `react-native-zip-archive`, and the unused `react-native-share` is gone.
3. **Run it in Expo Go.** Install Expo Go on your phone, run `npm start` and scan the QR code, with the phone and computer on the same Wi-Fi. The iOS Simulator also works through Xcode (press `i`).
4. **Walk through the flows on the phone:** sign in, log a roll with GPS, import a ZIP of scans, then check that everything appears on the web.
v1 runs on the phone through Expo Go only. A standalone install with its own icon (a development build, TestFlight or the App Store) comes after v1.

✅ `app.json` leftovers are fixed: a placeholder `assets/icon.png` (replace with real artwork) and the bundle ID is `com.sotieojo.filmlog`.

**Done when:** the app runs in Expo Go on your phone with no red-screen errors, and a roll logged on the phone appears on the web, and the reverse.

---

## 5. Security and deployment

The walks and profiles code still ships in v1, so its known database security gaps must be closed before the app goes public (see [ARCHITECTURE.md §8](ARCHITECTURE.md#8-security-model--known-limitations)):

- **Counter functions:** any signed-in user can call `increment_walk_completion`, `decrement_walk_completion` and `refresh_walk_avg_rating`. Replace them with triggers and revoke direct execute access.
- **Overlapping policies:** drop the README's original walk policies and keep `supabase/01_walks.sql`. Today the README's `read reviews … using (true)` makes every review readable, even when signed out.
- **Private profiles:** add a policy so other users can only read profiles where `is_public = true`.
- **Function hardening:** add `SET search_path = public` to every remaining `SECURITY DEFINER` function.

Every new table with user data (§6) gets row-level security limited to its owner.

**Deployment:** export the web build (`npx expo export --platform web`), host it on Vercel, Netlify or Cloudflare Pages with the two `EXPO_PUBLIC_SUPABASE_*` values set, and add the live URL to Supabase's Authentication URL configuration so password-reset links work. Put the link and a few screenshots at the top of the README.

---

## 6. Data model

New SQL goes in numbered scripts after `supabase/05_profiles_avatars.sql`.

```sql
-- Reference data: shared and read-only, except custom stocks
film_stocks (
  id, user_id,                        -- user_id null = shared; set = your custom stock
  name, brand, format,                -- e.g. 'Kodak Vision3 250D', '35mm'
  process,                            -- 'C-41' | 'E-6' | 'ECN-2' | 'B&W'
  box_iso, has_remjet boolean, notes
)

developers (
  id, name, process,
  kind,                               -- 'developer' (B&W) | 'kit' (C-41, E-6, ECN-2)
  dilutions text[],                   -- e.g. {'stock','1+1','1+3'}
  default_temp_c,
  capacity_rolls_per_liter,
  shelf_life_days,
  exhaustion_rule                     -- e.g. extend time X% per N rolls
)

dev_recipes (                         -- what the calculator looks up
  id, film_stock_id, developer_id, dilution, format,
  exposure_iso,                       -- box speed, push or pull
  temp_c, time_seconds,
  agitation,                          -- e.g. 'first 30s, then 10s every min'
  source                              -- the datasheet it came from
)

temp_compensation (                   -- the temperature chart for each process
  id, process, temp_c, time_factor
)

process_steps (
  id, process, step_order, name,      -- 'Remjet removal', 'Develop', 'Stop', 'Fix', 'Wash'
  temp_c, default_time_seconds, instructions,
  only_if_remjet boolean
)

-- Your data (row-level security per user)
film_purchases (id, user_id, film_stock_id, quantity, quantity_loaded,
                price, purchased_at, expires_at)
chemical_sets  (id, user_id, developer_id, dilution, volume_ml,
                mixed_at, rolls_used, notes)
batches        (id, user_id, chemical_set_id, process,
                actual_temp_c, actual_time_seconds, developed_at, status, notes)
lab_dropoffs   (id, user_id, lab_name, dropped_off_at, picked_up_at, cost, notes)
rolls          (..., film_stock_id, purchase_id, shot_at_iso, status,
                lab_develops boolean, lab_scans boolean,
                lab_dropoff_id, batch_id, ...)
```

Rolls already store development details as free text (`developer`, `dilution`, `devTime`, `devTemp`, `pushPull`). Keep these fields for rolls that have no batch, and show the batch's details for rolls that do.

---

## 7. Tests

Add Jest (`jest-expo`) and cover the core logic:

- calculator math: base time, push and pull, temperature compensation, exhaustion;
- mapping frame fields to EXIF metadata;
- status changes: every path in §2, and rejecting invalid moves;
- finishing a batch: roll statuses and the chemical set's count;
- unit conversion.

Keep this logic in plain functions under `src/utils/` so it can be tested without rendering screens.

---

## 8. v1 is done when

- You've used it end to end for your own rolls: buy, load, shoot, develop a batch with the calculator (or drop it off at a lab), scan, import, and safely delete local copies.
- It works on the web and on your phone, with sync between them.
- The tests in §7 pass.
- The security fixes in §5 are applied.
- It's deployed, with a link you can put on your resume.

## 9. Build order

1. Fix dependencies and get the app running on your phone (§4).
2. Apply the security fixes (§5).
3. Switch to the new status flow and add lab drop-offs (§2).
4. Finish storage: the "safe to delete locally" check (§3.2).
5. Add the reference tables and calculator, with tests (§3.3, §7).
6. Add chemical sets and batches (§3.3).
7. Add the inventory, the expired-film flag and the stats card (§3.4).
8. Add search and filters, export with photo metadata, and units (§3.5).
9. Use it on your next few rolls and fix what's missing.
10. Deploy (§5).

---

## 10. Not in v1

- **In-app development timer**, including background alerts.
- **v2:** sharing scans by text, email, Instagram and other apps through the phone's share sheet; full achievements, community photo walks and other social features (the existing walks, profiles and badges stay as they are); AI scan analysis; a Go/AWS scan-processing service; smart buying recommendations beyond simple stats.
- **Code health:** split `app/roll/[id].tsx` (about 2,300 lines) into components, and add timestamp-based conflict resolution to sync.
