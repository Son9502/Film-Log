import { useState, useMemo } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useFilmLogStore } from "@/store";
import Dropdown from "@/components/Dropdown";
import { COLORS } from "@/constants";
import {
  BW_STOCKS, BW_DEVELOPERS, BW_RECIPES, COLOR_KITS, COLOR_FILMS, PUSH_CURVES, BW_TEMP_CHART, BW_STEPS, bwPushCurve,
} from "@/constants/devData";
import { calculateDevTime, calculateKitTime, buildSteps, formatDuration, ProcessStep } from "@/utils/devCalc";
import { formatTemperature, temperatureToCelsius, temperatureFromCelsius } from "@/utils/units";

type Process = "B&W" | "C-41" | "E-6" | "ECN-2";
const PROCESSES: Process[] = ["B&W", "C-41", "E-6", "ECN-2"];
const CURVE_KEY = { "C-41": "c41", "E-6": "e6", "ECN-2": "ecn2" } as const;

export default function CalculatorScreen() {
  const [process, setProcess] = useState<Process>("B&W");
  const [filmId, setFilmId] = useState(BW_STOCKS[0].id);
  const [developerId, setDeveloperId] = useState("");
  const [dilution, setDilution] = useState("");
  const [kitId, setKitId] = useState("");
  const [iso, setIso] = useState(String(BW_STOCKS[0].boxIso));
  const [temp, setTemp] = useState<string | null>(null); // null = the recipe's temperature
  const [rolls, setRolls] = useState("0");
  const router = useRouter();
  const { rolls: allRolls, chemSets, temperatureUnit } = useFilmLogStore();

  const isBW = process === "B&W";
  const colorFilms = COLOR_FILMS.filter((f) => f.process === process);
  const kits = COLOR_KITS.filter((k) => k.process === process);

  const developers = useMemo(
    () => BW_DEVELOPERS.filter((d) => BW_RECIPES.some((r) => r.developerId === d.id && (r.filmStockId === filmId || r.filmStockId === "*"))),
    [filmId]
  );
  const devId = developers.some((d) => d.id === developerId) ? developerId : developers[0]?.id ?? "";
  const dilutions = useMemo(
    () => Array.from(new Set(BW_RECIPES.filter((r) => r.developerId === devId && (r.filmStockId === filmId || r.filmStockId === "*")).map((r) => r.dilution))),
    [devId, filmId]
  );
  const dil = dilutions.includes(dilution) ? dilution : dilutions[0] ?? "";
  const kit = kits.find((k) => k.id === kitId) ?? kits[0];
  const colorFilm = colorFilms.find((f) => f.id === filmId) ?? colorFilms[0];

  const recipe = BW_RECIPES.find((r) => (r.filmStockId === filmId || r.filmStockId === "*") && r.developerId === devId && r.dilution === dil);
  const defaultTemp = temperatureFromCelsius(recipe?.tempC ?? 20, temperatureUnit);
  // While the box is blank or half-typed, keep calculating at the recipe's temperature.
  const typedTemp = temp === null ? NaN : parseFloat(temp);
  const displayedTemp = Number.isFinite(typedTemp) ? typedTemp : defaultTemp;
  const tempC = temperatureToCelsius(displayedTemp, temperatureUnit);
  const shotIso = parseInt(iso, 10) || 0;

  const switchProcess = (p: Process) => {
    setProcess(p);
    setTemp(null);
    setRolls("0");
    setKitId("");
    if (p === "B&W") {
      setFilmId(BW_STOCKS[0].id);
      setIso(String(BW_STOCKS[0].boxIso));
    } else {
      const f = COLOR_FILMS.find((x) => x.process === p)!;
      setFilmId(f.id);
      setIso(String(f.boxIso));
    }
  };

  let develop: { seconds: number; baseSeconds: number; stops: number; notes: string[]; agitation?: string; baseTemp?: number | null } | null = null;
  let steps: ProcessStep[] = [];

  if (isBW) {
    const bwCurve = bwPushCurve(devId, filmId);
    const r = calculateDevTime({
      recipes: BW_RECIPES, filmStockId: filmId, developerId: devId, dilution: dil,
      shotIso, tempC, pushCurve: bwCurve.curve, tempChart: BW_TEMP_CHART,
    });
    if (r) {
      const notes = r.stops !== 0 ? [...r.notes, `Using ${bwCurve.label}.`] : r.notes;
      develop = { seconds: r.timeSeconds, baseSeconds: r.baseSeconds, stops: r.stops, notes, agitation: r.agitation, baseTemp: r.baseTempC };
      steps = buildSteps(BW_STEPS, false, r.timeSeconds, tempC);
    }
  } else if (kit && colorFilm) {
    const r = calculateKitTime({
      kit, shotIso, boxIso: colorFilm.boxIso, pushCurve: PUSH_CURVES[CURVE_KEY[process]], rollsDeveloped: parseInt(rolls, 10) || 0,
    });
    if (r) {
      const devStep = kit.steps.find((x) => x.isDevelop);
      develop = { seconds: r.developSeconds, baseSeconds: r.baseSeconds, stops: r.stops, notes: r.notes, agitation: devStep?.instructions, baseTemp: devStep?.tempC };
      steps = buildSteps(kit.steps, colorFilm.hasRemjet, r.developSeconds, devStep?.tempC);
    }
  }

  const developerName = isBW ? BW_DEVELOPERS.find((d) => d.id === devId)?.name ?? "" : kit?.name ?? "";
  const developTemp = isBW ? tempC : develop?.baseTemp ?? null;
  const waitingRolls = allRolls.filter((r) => r.status === "To Develop" || r.status === "In Development").length;
  const chemistryId = isBW ? devId : kit?.id ?? "";
  const hasMatchingSet = chemSets.some((c) => c.chemistryId === chemistryId);

  const filmItems = isBW
    ? BW_STOCKS.map((f) => ({ id: f.id, label: f.name, sub: `ISO ${f.boxIso}` }))
    : colorFilms.map((f) => ({ id: f.id, label: f.name, sub: `ISO ${f.boxIso}${f.hasRemjet ? " · remjet" : ""}` }));

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View style={s.tabs}>
        {PROCESSES.map((p) => (
          <TouchableOpacity key={p} style={[s.tab, p === process && s.tabActive]} onPress={() => switchProcess(p)}>
            <Text style={[s.tabText, p === process && s.tabTextActive]}>{p}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.label}>Film</Text>
      <Dropdown
        items={filmItems}
        selectedId={isBW ? filmId : colorFilm?.id}
        onSelect={(i) => {
          setFilmId(i.id);
          setTemp(null);
          const box = isBW ? BW_STOCKS.find((f) => f.id === i.id)?.boxIso : COLOR_FILMS.find((f) => f.id === i.id)?.boxIso;
          if (box) setIso(String(box));
        }}
      />

      {isBW ? (
        <>
          <Text style={s.label}>Developer</Text>
          <Dropdown
            items={developers.map((d) => ({ id: d.id, label: d.name, sub: d.character }))}
            selectedId={devId}
            onSelect={(i) => { setDeveloperId(i.id); setDilution(""); setTemp(null); }}
          />
          <Text style={s.label}>Dilution</Text>
          <Dropdown items={dilutions.map((d) => ({ id: d, label: d }))} selectedId={dil} onSelect={(i) => { setDilution(i.id); setTemp(null); }} />
        </>
      ) : (
        <>
          <Text style={s.label}>Kit</Text>
          <Dropdown items={kits.map((k) => ({ id: k.id, label: k.name }))} selectedId={kit?.id} onSelect={(i) => setKitId(i.id)} />
        </>
      )}

      <View style={s.row}>
        <View style={s.col}>
          <Text style={s.label}>Shot at ISO</Text>
          <TextInput style={s.input} value={iso} onChangeText={setIso} keyboardType="number-pad" />
        </View>
        {isBW ? (
          <View style={s.col}>
            <Text style={s.label}>Temp °{temperatureUnit}</Text>
            <TextInput style={s.input} value={temp ?? String(defaultTemp)} onChangeText={setTemp} keyboardType="decimal-pad" />
          </View>
        ) : (
          <View style={s.col}>
            <Text style={s.label}>Rolls already used</Text>
            <TextInput style={s.input} value={rolls} onChangeText={setRolls} keyboardType="number-pad" />
          </View>
        )}
      </View>

      {develop ? (
        <View style={s.card}>
          <Text style={s.cardLabel}>{isBW ? "Developer time" : "Developer step"}</Text>
          <Text style={s.time}>{formatDuration(develop.seconds)}</Text>
          <Text style={s.meta}>
            base {formatDuration(develop.baseSeconds)}{develop.baseTemp != null ? ` @ ${formatTemperature(develop.baseTemp, temperatureUnit)}` : ""}
            {develop.stops !== 0 ? ` · ${develop.stops > 0 ? "+" : ""}${develop.stops} stops` : ""}
          </Text>
          {develop.agitation ? <Text style={s.meta}>{develop.agitation}</Text> : null}
          {develop.notes.map((n) => <Text key={n} style={s.note}>{n}</Text>)}
          <View style={s.steps}>
            {steps.map((st) => (
              <View key={`${st.order}-${st.name}`} style={s.step}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={[s.stepName, st.isDevelop && { color: COLORS.amberLight }]}>{st.order}. {st.name}</Text>
                  {st.tempC != null || st.instructions ? (
                    <Text style={s.stepSub}>{[st.tempC != null ? formatTemperature(st.tempC, temperatureUnit) : "", st.instructions].filter(Boolean).join(" · ")}</Text>
                  ) : null}
                </View>
                <Text style={s.stepTime}>{formatDuration(st.timeSeconds)}</Text>
              </View>
            ))}
          </View>
          <View style={s.saveBox}>
            <Text style={s.cardLabel}>Developing now?</Text>
            <Text style={s.meta}>
              {waitingRolls > 0
                ? `${waitingRolls} roll${waitingRolls === 1 ? " is" : "s are"} waiting to be developed.`
                : "No rolls are waiting to be developed yet."}
              {hasMatchingSet ? "" : ` Add a ${developerName} chemical set on the Develop tab to log a batch with it.`}
            </Text>
            <TouchableOpacity
              style={s.saveBtn}
              onPress={() => router.push({
                pathname: "/batch/new",
                params: {
                  time: String(develop!.seconds),
                  temp: developTemp != null ? String(temperatureFromCelsius(developTemp, temperatureUnit)) : "",
                  process,
                  chemistryId,
                  dilution: isBW ? dil : "",
                },
              })}
            >
              <Text style={s.saveBtnText}>Start a batch with these settings</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <Text style={s.note}>No recipe for this combination.</Text>
      )}
      <Text style={s.disclaimer}>Starting points only. Confirm against the datasheet for your kit and film.</Text>
    </ScrollView>
  );
}

const mono = "Courier New";
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  tabs: { flexDirection: "row", borderWidth: 1, borderColor: COLORS.border },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center" },
  tabActive: { backgroundColor: COLORS.amberDim },
  tabText: { fontSize: 11, color: COLORS.textMuted, fontFamily: mono, letterSpacing: 1 },
  tabTextActive: { color: COLORS.textPrimary },
  label: { fontSize: 10, color: COLORS.textMuted, fontFamily: mono, letterSpacing: 1, marginTop: 14, marginBottom: 6, textTransform: "uppercase" },
  row: { flexDirection: "row", gap: 10 },
  col: { flex: 1, minWidth: 0 },
  input: { borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard, color: COLORS.textPrimary, fontFamily: mono, padding: 10 },
  card: { marginTop: 22, borderWidth: 1, borderColor: COLORS.amberDim, backgroundColor: COLORS.bgCard, padding: 16 },
  cardLabel: { fontSize: 10, color: COLORS.textMuted, fontFamily: mono, letterSpacing: 1, textTransform: "uppercase" },
  time: { fontSize: 40, color: COLORS.amberLight, fontFamily: mono },
  meta: { fontSize: 11, color: COLORS.textMuted, fontFamily: mono, marginTop: 4 },
  note: { fontSize: 11, color: COLORS.amber, fontFamily: mono, marginTop: 8, lineHeight: 16 },
  steps: { marginTop: 16, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 8 },
  step: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingVertical: 6 },
  stepName: { fontSize: 12, color: COLORS.textPrimary, fontFamily: mono, flexShrink: 1 },
  stepSub: { fontSize: 10, color: COLORS.textDim, fontFamily: mono, marginTop: 2 },
  stepTime: { fontSize: 12, color: COLORS.textSecondary, fontFamily: mono },
  disclaimer: { fontSize: 10, color: COLORS.textDim, fontFamily: mono, marginTop: 16, textAlign: "center" },
  saveBox: { marginTop: 16, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 14 },
  saveBtn: { marginTop: 10, backgroundColor: COLORS.amberDim, paddingVertical: 11, alignItems: "center" },
  saveBtnText: { color: COLORS.textPrimary, fontFamily: mono, fontSize: 12, letterSpacing: 1 },
});
