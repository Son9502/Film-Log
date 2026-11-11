import { FilmPurchase, FilmStock, LabDropoff, Roll } from "@/types";

export interface MonthSummary {
  rollsLoaded: number;
  framesShot: number;
  topStocks: { name: string; rolls: number }[];
  filmSpend: number;
  labSpend: number;
  totalSpend: number;
}

const monthKey = (iso: string) => iso.slice(0, 7);

export function monthSummary(
  rolls: Roll[],
  purchases: FilmPurchase[],
  dropoffs: LabDropoff[],
  stocks: FilmStock[],
  now: Date = new Date(),
  scope: "month" | "all" = "month"
): MonthSummary {
  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const inScope = (iso?: string) => !!iso && (scope === "all" || monthKey(iso) === key);

  const loaded = rolls.filter((r) => inScope(r.loadedAt));
  const counts = new Map<string, number>();
  for (const r of loaded) counts.set(r.filmStockId, (counts.get(r.filmStockId) ?? 0) + 1);
  const topStocks = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, n]) => ({ name: stocks.find((s) => s.id === id)?.name ?? id, rolls: n }));

  const framesShot = rolls.reduce(
    (n, r) => n + r.shots.filter((s) => inScope(s.timestamp ?? r.loadedAt)).length,
    0
  );
  const filmSpend = purchases.filter((p) => inScope(p.purchasedAt)).reduce((n, p) => n + (p.price ?? 0), 0);
  const labSpend = dropoffs.filter((d) => inScope(d.droppedOffAt)).reduce((n, d) => n + (d.cost ?? 0), 0);

  return {
    rollsLoaded: loaded.length,
    framesShot,
    topStocks,
    filmSpend,
    labSpend,
    totalSpend: filmSpend + labSpend,
  };
}
