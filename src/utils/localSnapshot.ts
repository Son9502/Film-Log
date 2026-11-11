import type {
  Roll, FilmPurchase, LabDropoff, ChemicalSet, DevBatch, Camera, FilmStock,
  LocationJournal, Walk, WalkCompletion, WalkReview,
} from "@/types";
import type { DistanceUnit, TemperatureUnit } from "@/utils/units";

export interface LocalSnapshotData {
  rolls: Roll[];
  purchases: FilmPurchase[];
  dropoffs: LabDropoff[];
  chemSets: ChemicalSet[];
  batches: DevBatch[];
  cameras: Camera[];
  filmStocks: FilmStock[];
  journals: LocationJournal[];
  personalWalks: Walk[];
  completions: WalkCompletion[];
  myReviews: WalkReview[];
  shownProgressNudges: string[];
  temperatureUnit: TemperatureUnit;
  distanceUnit: DistanceUnit;
}

export function createLocalSnapshot(data: LocalSnapshotData, userId: string | null, exportedAt: string) {
  return {
    format: "film-log-local-snapshot",
    version: 1,
    exportedAt,
    userId,
    data: {
      rolls: data.rolls,
      purchases: data.purchases,
      dropoffs: data.dropoffs,
      chemSets: data.chemSets,
      batches: data.batches,
      cameras: data.cameras,
      filmStocks: data.filmStocks,
      journals: data.journals,
      personalWalks: data.personalWalks,
      completions: data.completions,
      myReviews: data.myReviews,
      shownProgressNudges: data.shownProgressNudges,
      temperatureUnit: data.temperatureUnit,
      distanceUnit: data.distanceUnit,
    },
  };
}
