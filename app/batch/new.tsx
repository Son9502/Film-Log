import { useMemo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Switch } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useFilmLogStore } from "@/store";
import { COLORS } from "@/constants";
import { uid, todayISO } from "@/utils";
import { chemSetWarning, formatStops, parseDuration } from "@/utils/chemistry";
import { DEFAULT_ML_PER_ROLL, minimumWarning, mixFor } from "@/utils/mix";
import { formatDuration, stopsText } from "@/utils/devCalc";
import { planBatch } from "@/utils/batchPlan";
import { stockProcess } from "@/utils/filmMatch";
import type { DevProcess, Roll } from "@/types";
import Dropdown from "@/components/Dropdown";
import { formatTemperature, temperatureFromCelsius, temperatureToCelsius } from "@/utils/units";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MIN_STOPS = -2;
const MAX_STOPS = 3;

export default function NewBatchScreen() {
  const router = useRouter();
  // From the calculator: time, temp, process, chemistryId, dilution. From a roll page: rollId.
  const params = useLocalSearchParams<{
    time?: string; temp?: string; process?: string; chemistryId?: string; dilution?: string; rollId?: string;
  }>();
  const { rolls, chemSets, batches, filmStocks, finishBatch, temperatureUnit } = useFilmLogStore();

  const candidates = rolls.filter((r) => r.status === "To Develop" || r.status === "In Development");
  const rollProcess = (r: Roll): DevProcess | null => stockProcess(filmStocks.find((f) => f.id === r.filmStockId));
  const sets = params.process ? chemSets.filter((c) => c.process === params.process) : chemSets;
  // From a roll page, prefer a set for that roll's process.
  const fromRoll = params.rollId ? candidates.find((r) => r.id === params.rollId) : undefined;
  const fromRollProcess = fromRoll ? rollProcess(fromRoll) : null;
  // Prefer the set that matches what the calculator was showing.
  const preferredSet =
    sets.find((c) => c.chemistryId === params.chemistryId && c.dilution === params.dilution) ??
    sets.find((c) => c.chemistryId === params.chemistryId) ??
    sets.find((c) => c.process === fromRollProcess) ??
    sets[0];
  const lastFixerFor = (process?: DevProcess) =>
    [...batches].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).find((b) => b.fixer && b.process === process)?.fixer ?? "";

  // "" until the user picks; falls back to the preferred set (which may only exist once
  // saved data has loaded, e.g. when this page is opened directly on the web).
  const [chosenSetId, setSetId] = useState("");
  const setId = chosenSetId || preferredSet?.id || "";
  const [picked, setPicked] = useState<string[]>(fromRoll ? [fromRoll.id] : []);
  const [fixerText, setFixer] = useState<string | null>(null); // null = last fixer for this process
  // Push/pull for rolls the calculator has no data on (it works out the rest from ISO).
  const [manualStops, setManualStops] = useState<Record<string, number>>({});
  const [wettingAgent, setWettingAgent] = useState(true);
  const [solutionText, setSolutionText] = useState<string | null>(null); // null = rolls × default
  // null means "use the suggested value"
  const [timeText, setTime] = useState<string | null>(params.time ? formatDuration(parseInt(params.time, 10)) : null);
  const [tempText, setTemp] = useState<string | null>(params.temp ?? null);
  const [developedAt, setDevelopedAt] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const chemSet = chemSets.find((c) => c.id === setId);
  const fixer = fixerText ?? lastFixerFor(chemSet?.process);
  // Only offer rolls this chemistry can develop. Rolls whose film has no process set stay
  // visible (marked) so they can still be picked.
  const matching = chemSet ? candidates.filter((r) => rollProcess(r) === chemSet.process) : candidates;
  const unknownProcess = chemSet ? candidates.filter((r) => rollProcess(r) === null) : [];
  const otherProcessCount = candidates.length - matching.length - unknownProcess.length;
  const chooseSet = (id: string) => {
    const next = chemSets.find((c) => c.id === id);
    setSetId(id);
    if (next) {
      setPicked((p) => p.filter((rid) => {
        const r = candidates.find((x) => x.id === rid);
        const pr = r ? rollProcess(r) : null;
        return pr === null || pr === next.process;
      }));
    }
  };
  // A picked roll that this set can't develop (e.g. after switching sets) doesn't count.
  const pickedRolls = useMemo(
    () => [...matching, ...unknownProcess].filter((r) => picked.includes(r.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [candidates, picked, chemSet?.process, filmStocks]
  );
  const warning = chemSet ? chemSetWarning(chemSet, todayISO()) : null;

  const tempOverride = tempText !== null && Number.isFinite(parseFloat(tempText))
    ? temperatureToCelsius(parseFloat(tempText), temperatureUnit)
    : undefined;
  const plan = useMemo(
    () => planBatch({ rolls: pickedRolls, stocks: filmStocks, set: chemSet, tempC: tempOverride, today: todayISO() }),
    [pickedRolls, filmStocks, chemSet, tempOverride]
  );
  const time = timeText ?? (plan.seconds ? formatDuration(plan.seconds) : "");
  const temp = tempText ?? (plan.tempC != null ? String(temperatureFromCelsius(plan.tempC, temperatureUnit)) : "");
  const blocked = plan.blockers.length > 0;
  const solutionMl = solutionText !== null
    ? parseInt(solutionText, 10) || 0
    : Math.max(pickedRolls.length, 1) * DEFAULT_ML_PER_ROLL;
  const mix = chemSet ? mixFor(solutionMl, chemSet.process === "B&W" ? chemSet.dilution : "Stock") : null;
  const mixWarning = chemSet ? minimumWarning(mix, pickedRolls.length, chemSet.minStockMlPerRoll) : null;
  const stockName = (id: string) => filmStocks.find((f) => f.id === id)?.name ?? "Unknown film";
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const manualStopsFor = (r: Roll) => manualStops[r.id] ?? (parseInt(r.pushPull ?? "", 10) || 0);

  const rollRow = (r: Roll, unknown: boolean) => {
    const on = picked.includes(r.id);
    const rp = plan.rolls.find((x) => x.rollId === r.id);
    const needsManual = on && rp && !rp.match;
    const stops = manualStopsFor(r);
    const timing = rp?.seconds
      ? `${rp.stops ? ` · ${formatStops(rp.stops)} stop` : ""} · ${formatDuration(rp.seconds)}`
      : "";
    return (
      <TouchableOpacity key={r.id} style={[s.roll, on && s.rollOn]} onPress={() => toggle(r.id)}>
        <Text style={s.check}>{on ? "☑" : "☐"}</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.rollName}>{r.name || stockName(r.filmStockId)}</Text>
          <Text style={s.rollSub}>
            {stockName(r.filmStockId)} · ISO {r.iso}{r.expiryCompStops ? ` (${stopsText(r.expiryCompStops)} for age)` : ""} · {r.shots.length} frames{unknown ? " · process?" : ""}{timing}
          </Text>
          {needsManual ? (
            <View style={s.stepRow}>
              <Text style={s.stepLabel}>Push/pull</Text>
              <TouchableOpacity style={s.stepBtn} disabled={stops <= MIN_STOPS} onPress={() => setManualStops((m) => ({ ...m, [r.id]: stops - 1 }))}>
                <Text style={[s.stepBtnText, stops <= MIN_STOPS && { opacity: 0.3 }]}>−</Text>
              </TouchableOpacity>
              <Text style={s.stepValue}>{stops === 0 ? "None" : `${formatStops(stops)} stop${Math.abs(stops) === 1 ? "" : "s"}`}</Text>
              <TouchableOpacity style={s.stepBtn} disabled={stops >= MAX_STOPS} onPress={() => setManualStops((m) => ({ ...m, [r.id]: stops + 1 }))}>
                <Text style={[s.stepBtnText, stops >= MAX_STOPS && { opacity: 0.3 }]}>+</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const finish = () => {
    const seconds = parseDuration(time);
    const tempC = temperatureToCelsius(parseFloat(temp), temperatureUnit);
    if (!chemSet) { setError("Choose a chemical set."); return; }
    if (pickedRolls.length === 0) { setError("Pick at least one roll."); return; }
    if (blocked) { setError("Resolve the problems above first."); return; }
    if (!seconds || seconds <= 0) { setError("Enter the time used as m:ss."); return; }
    if (!Number.isFinite(tempC)) { setError("Enter the temperature used."); return; }
    if (!DATE_RE.test(developedAt)) { setError("Date must be YYYY-MM-DD."); return; }
    // Recognised films get the push/pull worked out from ISO; the rest get what was entered here.
    const stopsByRoll = Object.fromEntries(plan.rolls.map((p) => {
      const r = pickedRolls.find((x) => x.id === p.rollId)!;
      return [p.rollId, p.match ? p.stops : manualStopsFor(r)];
    }));
    finishBatch({
      id: uid(),
      chemicalSetId: chemSet.id,
      process: chemSet.process,
      tempC,
      timeSeconds: seconds,
      developedAt,
      rollIds: pickedRolls.map((r) => r.id),
      fixer: fixer.trim() || undefined,
      wettingAgent,
      solutionMl: solutionMl > 0 ? solutionMl : undefined,
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString(),
    }, stopsByRoll);
    router.replace(params.rollId ? { pathname: "/roll/[id]", params: { id: params.rollId } } : "/develop");
  };

  if (sets.length === 0) {
    return (
      <View style={[s.container, { padding: 16 }]}>
        <Text style={s.empty}>
          {params.process ? `No ${params.process} chemical sets yet.` : "No chemical sets yet."} Add one to start a batch.
        </Text>
        <TouchableOpacity style={s.primary} onPress={() => router.replace("/develop")}>
          <Text style={s.primaryText}>Go to the Develop tab</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={s.label}>Chemical set</Text>
      <Dropdown
        items={sets.map((c) => ({ id: c.id, label: c.name, sub: `${c.chemistryName}${c.dilution ? ` · ${c.dilution}` : ""}` }))}
        selectedId={setId}
        onSelect={(i) => chooseSet(i.id)}
      />
      {warning ? <Text style={s.warn}>⚠ {warning}. You can still log the batch.</Text> : null}

      <Text style={s.label}>Rolls to develop</Text>
      {candidates.length === 0 ? (
        <Text style={s.empty}>No rolls are waiting to be developed. Set a roll to To Develop from its page first.</Text>
      ) : matching.length === 0 && unknownProcess.length === 0 ? (
        <Text style={s.empty}>No {chemSet?.process} rolls are waiting to be developed.</Text>
      ) : (
        matching.map((r) => rollRow(r, false))
      )}
      {unknownProcess.length > 0 && (
        <>
          <Text style={s.subLabel}>Film process not set</Text>
          <Text style={s.hint}>Set the process on these film stocks in Settings → Gear so they're sorted automatically.</Text>
          {unknownProcess.map((r) => rollRow(r, true))}
        </>
      )}
      {otherProcessCount > 0 && chemSet ? (
        <Text style={s.hint}>
          {otherProcessCount} roll{otherProcessCount === 1 ? "" : "s"} for other processes hidden. Pick a different chemical set to develop {otherProcessCount === 1 ? "it" : "them"}.
        </Text>
      ) : null}

      {plan.blockers.map((b) => <Text key={b} style={s.error}>✕ {b}</Text>)}
      {plan.warnings.map((w, i) => (
        <Text key={w} style={[s.warn, plan.timeMismatch && i === 0 && s.notice]}>⚠ {w}</Text>
      ))}
      {plan.seconds ? (
        <Text style={s.hint}>Suggested: {formatDuration(plan.seconds)}{plan.tempC != null ? ` at ${formatTemperature(plan.tempC, temperatureUnit)}` : ""}. Change the temperature and the time follows.</Text>
      ) : null}

      <View style={s.row}>
        <View style={s.col}>
          <Text style={s.label}>Time used (m:ss)</Text>
          <TextInput style={s.input} value={time} onChangeText={(v) => setTime(v)} placeholder="6:45" placeholderTextColor={COLORS.textDim} />
        </View>
        <View style={s.col}>
          <Text style={s.label}>Temp °{temperatureUnit}</Text>
          <TextInput style={s.input} value={temp} onChangeText={setTemp} keyboardType="decimal-pad" placeholder="20" placeholderTextColor={COLORS.textDim} />
        </View>
      </View>

      <Text style={s.label}>Working solution (ml)</Text>
      <TextInput
        style={s.input}
        value={solutionText ?? String(solutionMl)}
        onChangeText={(v) => setSolutionText(v.replace(/[^0-9]/g, ""))}
        keyboardType="number-pad"
      />
      <Text style={s.hint}>
        About {DEFAULT_ML_PER_ROLL} ml per 35mm reel and 500 ml per 120 reel; check your tank's markings.
      </Text>
      {mix && chemSet ? (
        <Text style={s.mix}>
          {mix.waterMl > 0
            ? `Mix ${mix.concentrateMl} ml ${chemSet.chemistryName} + ${mix.waterMl} ml water (${chemSet.dilution}).`
            : `Use ${solutionMl} ml of ${chemSet.process === "B&W" ? "stock" : "working"} solution.`}
        </Text>
      ) : chemSet?.dilution && chemSet.process === "B&W" ? (
        <Text style={s.hint}>Can't read the dilution "{chemSet.dilution}" to work out the mix.</Text>
      ) : null}
      {mixWarning ? <Text style={s.warn}>⚠ {mixWarning}</Text> : null}

      <Text style={s.label}>{chemSet?.process === "B&W" || !chemSet ? "Fixer" : "Fixer / blix"}</Text>
      <TextInput
        style={s.input}
        value={fixer}
        onChangeText={setFixer}
        placeholder={chemSet?.process === "B&W" || !chemSet ? "e.g. Ilford Rapid Fixer" : "e.g. the kit's blix, or a separate fixer"}
        placeholderTextColor={COLORS.textDim}
      />
      <View style={s.toggleRow}>
        <Text style={s.toggleLabel}>Wetting agent (Photo-Flo / Ilfotol)</Text>
        <Switch
          value={wettingAgent}
          onValueChange={setWettingAgent}
          trackColor={{ false: COLORS.border, true: COLORS.amberDim }}
          thumbColor={wettingAgent ? COLORS.amber : COLORS.textDim}
        />
      </View>

      <Text style={s.label}>Date developed</Text>
      <TextInput style={s.input} value={developedAt} onChangeText={setDevelopedAt} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.textDim} />
      <Text style={s.label}>Notes</Text>
      <TextInput style={[s.input, { minHeight: 60 }]} value={notes} onChangeText={setNotes} multiline />

      {error ? <Text style={s.error}>{error}</Text> : null}
      <TouchableOpacity style={[s.primary, { marginTop: 18 }, blocked && { opacity: 0.4 }]} onPress={finish} disabled={blocked}>
        <Text style={s.primaryText}>Finish batch → In Scanning</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const mono = "Courier New";
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  stepLabel: { fontSize: 10, color: COLORS.textMuted, fontFamily: mono, textTransform: "uppercase", letterSpacing: 1, marginRight: 4 },
  stepBtn: { borderWidth: 1, borderColor: COLORS.border, width: 32, height: 28, alignItems: "center", justifyContent: "center" },
  stepBtnText: { color: COLORS.amberLight, fontFamily: mono, fontSize: 15 },
  stepValue: { minWidth: 72, textAlign: "center", color: COLORS.textPrimary, fontFamily: mono, fontSize: 12 },
  notice: { borderWidth: 1, borderColor: COLORS.amberDim, backgroundColor: COLORS.bgCard, padding: 10, lineHeight: 17 },
  subLabel: { fontSize: 10, color: COLORS.textMuted, fontFamily: mono, letterSpacing: 1, marginTop: 10, textTransform: "uppercase" },
  label: { fontSize: 10, color: COLORS.textMuted, fontFamily: mono, letterSpacing: 1, marginTop: 14, marginBottom: 6, textTransform: "uppercase" },
  row: { flexDirection: "row", gap: 10 },
  col: { flex: 1, minWidth: 0 },
  input: { borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard, color: COLORS.textPrimary, fontFamily: mono, padding: 10 },
  roll: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard, padding: 12, marginBottom: 8 },
  rollOn: { borderColor: COLORS.amber },
  check: { fontSize: 18, color: COLORS.amberLight },
  rollName: { fontSize: 13, color: COLORS.textPrimary, fontFamily: mono },
  rollSub: { fontSize: 10, color: COLORS.textMuted, fontFamily: mono, marginTop: 2 },
  hint: { fontSize: 11, color: COLORS.textMuted, fontFamily: mono, marginTop: 10 },
  warn: { fontSize: 11, color: COLORS.amberLight, fontFamily: mono, marginTop: 8 },
  empty: { fontSize: 12, color: COLORS.textMuted, fontFamily: mono, lineHeight: 18, marginBottom: 12 },
  link: { fontSize: 11, color: COLORS.amberLight, fontFamily: mono, marginTop: 10 },
  mix: { fontSize: 12, color: COLORS.amberLight, fontFamily: mono, marginTop: 8, lineHeight: 17 },
  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard, paddingHorizontal: 12, paddingVertical: 8, marginTop: 14 },
  toggleLabel: { flex: 1, fontSize: 12, color: COLORS.textPrimary, fontFamily: mono },
  error: { fontSize: 11, color: COLORS.danger, fontFamily: mono, marginTop: 14 },
  primary: { backgroundColor: COLORS.amberDim, paddingVertical: 13, alignItems: "center" },
  primaryText: { color: COLORS.textPrimary, fontFamily: mono, fontSize: 12, letterSpacing: 1 },
});
