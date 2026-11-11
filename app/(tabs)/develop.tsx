import { useState, useMemo } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useFilmLogStore } from "@/store";
import { COLORS } from "@/constants";
import { BW_DEVELOPERS, BW_RECIPES, COLOR_KITS } from "@/constants/devData";
import { uid, todayISO, formatDate } from "@/utils";
import { chemSetStatus, chemSetWarning, rollIdsForSet } from "@/utils/chemistry";
import { formatDuration } from "@/utils/devCalc";
import { formatTemperature } from "@/utils/units";
import { DevProcess } from "@/types";
import Dropdown from "@/components/Dropdown";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PROCESSES: DevProcess[] = ["B&W", "C-41", "E-6", "ECN-2"];

const toInt = (v: string) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

export default function DevelopScreen() {
  const router = useRouter();
  const { chemSets, batches, rolls, addChemSet, updateChemSet, deleteChemSet, temperatureUnit } = useFilmLogStore();

  const [adding, setAdding] = useState(false);
  const [process, setProcess] = useState<DevProcess>("B&W");
  const [chemId, setChemId] = useState("");
  const [dilution, setDilution] = useState("");
  const [name, setName] = useState("");
  const [volume, setVolume] = useState("");
  const [mixedAt, setMixedAt] = useState(todayISO());
  const [capacity, setCapacity] = useState("");
  const [shelfLife, setShelfLife] = useState("");
  const [minStock, setMinStock] = useState("");
  const [expandedSetId, setExpandedSetId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const options = useMemo(
    () =>
      process === "B&W"
        ? BW_DEVELOPERS.map((d) => ({ id: d.id, label: d.name, sub: d.character }))
        : COLOR_KITS.filter((k) => k.process === process).map((k) => ({ id: k.id, label: k.name })),
    [process]
  );
  const selectedId = options.some((o) => o.id === chemId) ? chemId : options[0]?.id ?? "";
  const dilutions = useMemo(
    () => (process === "B&W" ? Array.from(new Set(BW_RECIPES.filter((r) => r.developerId === selectedId).map((r) => r.dilution))) : []),
    [process, selectedId]
  );
  const dil = dilutions.includes(dilution) ? dilution : dilutions[0];
  const today = todayISO();

  const save = () => {
    const chosen = options.find((o) => o.id === selectedId);
    if (!chosen) { setError("Choose a developer or kit."); return; }
    if (!DATE_RE.test(mixedAt)) { setError("Date mixed must be YYYY-MM-DD."); return; }
    const now = new Date().toISOString();
    addChemSet({
      id: uid(),
      name: name.trim() || `${chosen.label}${dil ? ` ${dil}` : ""}`,
      process,
      chemistryId: selectedId,
      chemistryName: chosen.label,
      dilution: dil,
      volumeMl: toInt(volume),
      mixedAt,
      capacityRolls: toInt(capacity),
      shelfLifeDays: toInt(shelfLife),
      minStockMlPerRoll: (() => { const n = parseFloat(minStock); return Number.isFinite(n) && n > 0 ? n : undefined; })(),
      rollsUsed: 0,
      createdAt: now,
      updatedAt: now,
    });
    setAdding(false);
    setName(""); setVolume(""); setCapacity(""); setShelfLife(""); setMinStock(""); setError("");
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View style={s.actions}>
        <TouchableOpacity style={s.primary} onPress={() => setAdding((a) => !a)}>
          <Text style={s.primaryText}>{adding ? "Cancel" : "+ New chemical set"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.secondary} onPress={() => router.push("/batch/new")}>
          <Text style={s.secondaryText}>Start a batch</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={[s.secondary, { marginTop: 10, flex: 0 }]} onPress={() => router.push("/calculator")}>
        <Text style={s.secondaryText}>Development calculator</Text>
      </TouchableOpacity>

      {adding && (
        <View style={s.form}>
          <View style={s.tabs}>
            {PROCESSES.map((p) => (
              <TouchableOpacity key={p} style={[s.tab, p === process && s.tabActive]} onPress={() => { setProcess(p); setChemId(""); setDilution(""); }}>
                <Text style={[s.tabText, p === process && s.tabTextActive]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.label}>{process === "B&W" ? "Developer" : "Kit"}</Text>
          <Dropdown items={options} selectedId={selectedId} onSelect={(i) => { setChemId(i.id); setDilution(""); }} />
          {dilutions.length > 0 && (
            <>
              <Text style={s.label}>Dilution</Text>
              <Dropdown items={dilutions.map((d) => ({ id: d, label: d }))} selectedId={dil} onSelect={(i) => setDilution(i.id)} />
            </>
          )}
          <Text style={s.label}>Name (optional)</Text>
          <TextInput style={s.input} value={name} onChangeText={setName} placeholder="e.g. Jug A" placeholderTextColor={COLORS.textDim} />
          <View style={s.row}>
            <View style={s.col}>
              <Text style={s.label}>Date mixed</Text>
              <TextInput style={s.input} value={mixedAt} onChangeText={setMixedAt} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.textDim} />
            </View>
            <View style={s.col}>
              <Text style={s.label}>Volume (ml)</Text>
              <TextInput style={s.input} value={volume} onChangeText={setVolume} keyboardType="number-pad" />
            </View>
          </View>
          <View style={s.row}>
            <View style={s.col}>
              <Text style={s.label}>Capacity (rolls)</Text>
              <TextInput style={s.input} value={capacity} onChangeText={setCapacity} keyboardType="number-pad" />
            </View>
            <View style={s.col}>
              <Text style={s.label}>Shelf life (days)</Text>
              <TextInput style={s.input} value={shelfLife} onChangeText={setShelfLife} keyboardType="number-pad" />
            </View>
          </View>
          {process === "B&W" && (
            <>
              <Text style={s.label}>Min. concentrate per roll (ml)</Text>
              <TextInput style={s.input} value={minStock} onChangeText={setMinStock} keyboardType="decimal-pad" placeholder="optional" placeholderTextColor={COLORS.textDim} />
            </>
          )}
          <Text style={s.hint}>
            Take capacity, shelf life and any minimum concentrate per roll from your kit or developer datasheet. Leave blank for no limit.
          </Text>
          {error ? <Text style={s.error}>{error}</Text> : null}
          <TouchableOpacity style={[s.primary, { marginTop: 14 }]} onPress={save}>
            <Text style={s.primaryText}>Save set</Text>
          </TouchableOpacity>
        </View>
      )}

      {chemSets.length === 0 && !adding && (
        <Text style={s.empty}>No chemical sets yet. Add the developer or kit you've mixed to track its shelf life and how many rolls it has done.</Text>
      )}

      {chemSets.map((c) => {
        const st = chemSetStatus(c, today);
        const warning = chemSetWarning(c, today);
        return (
          <View key={c.id} style={[s.card, warning ? s.cardWarn : null]}>
            <View style={s.cardTop}>
              <Text style={s.cardTitle}>{c.name}</Text>
              <Text style={s.badge}>{c.process}</Text>
            </View>
            <Text style={s.meta}>{c.chemistryName}{c.dilution ? ` · ${c.dilution}` : ""}{c.volumeMl ? ` · ${c.volumeMl} ml` : ""}</Text>
            <Text style={s.meta}>
              Mixed {formatDate(c.mixedAt)}
              {st.daysLeft != null ? ` · ${st.daysLeft >= 0 ? `${st.daysLeft} days left` : `${-st.daysLeft} days over`}` : ""}
            </Text>
            <Text style={s.meta}>
              {c.rollsUsed} roll{c.rollsUsed === 1 ? "" : "s"} developed
              {c.capacityRolls != null ? ` of ${c.capacityRolls}` : ""}
            </Text>
            {warning ? <Text style={s.warn}>⚠ {warning}</Text> : null}
            {(() => {
              const developed = rollIdsForSet(batches, c.id)
                .map((id) => rolls.find((r) => r.id === id))
                .filter((r): r is NonNullable<typeof r> => !!r);
              if (developed.length === 0) return null;
              const open = expandedSetId === c.id;
              const shown = open ? developed : developed.slice(0, 3);
              return (
                <View style={s.setRolls}>
                  <Text style={s.setRollsLabel}>Rolls developed in this set</Text>
                  {shown.map((r) => (
                    <TouchableOpacity key={r.id} onPress={() => router.push(`/roll/${r.id}`)}>
                      <Text style={s.link}>{r.name || "Untitled roll"} ›</Text>
                    </TouchableOpacity>
                  ))}
                  {developed.length > 3 && (
                    <TouchableOpacity onPress={() => setExpandedSetId(open ? null : c.id)}>
                      <Text style={s.more}>{open ? "Show fewer" : `Show all ${developed.length}`}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })()}
            <View style={s.cardActions}>
              <TouchableOpacity onPress={() => updateChemSet({ ...c, rollsUsed: Math.max(0, c.rollsUsed - 1), updatedAt: new Date().toISOString() })}>
                <Text style={s.link}>− roll</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => updateChemSet({ ...c, rollsUsed: c.rollsUsed + 1, updatedAt: new Date().toISOString() })}>
                <Text style={s.link}>+ roll</Text>
              </TouchableOpacity>
              {confirmDeleteId === c.id ? (
                <TouchableOpacity onPress={() => { deleteChemSet(c.id); setConfirmDeleteId(null); }}>
                  <Text style={[s.link, { color: COLORS.danger }]}>Confirm delete</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => setConfirmDeleteId(c.id)}>
                  <Text style={s.link}>Delete</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}

      {batches.length > 0 && (
        <>
          <Text style={[s.label, { marginTop: 24 }]}>Recent batches</Text>
          {[...batches].sort((a, b) => b.developedAt.localeCompare(a.developedAt)).slice(0, 10).map((b) => {
            const set = chemSets.find((c) => c.id === b.chemicalSetId);
            return (
              <View key={b.id} style={s.card}>
                <View style={s.cardTop}>
                  <Text style={s.cardTitle}>{formatDate(b.developedAt)}</Text>
                  <Text style={s.badge}>{b.process}</Text>
                </View>
                <Text style={s.meta}>{set?.name ?? "Deleted set"} · {formatDuration(b.timeSeconds)} at {formatTemperature(b.tempC, temperatureUnit)}</Text>
                {(b.fixer || b.wettingAgent != null || b.solutionMl) ? (
                  <Text style={s.meta}>
                    {[b.solutionMl && `${b.solutionMl} ml`, b.fixer, b.wettingAgent ? "wetting agent" : b.wettingAgent === false ? "no wetting agent" : null].filter(Boolean).join(" · ")}
                  </Text>
                ) : null}
                {b.rollIds.map((id) => {
                  const r = rolls.find((x) => x.id === id);
                  return r ? (
                    <TouchableOpacity key={id} onPress={() => router.push(`/roll/${id}`)}>
                      <Text style={s.link}>{r.name || "Roll"} ›</Text>
                    </TouchableOpacity>
                  ) : null;
                })}
              </View>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

const mono = "Courier New";
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  primary: { flex: 1, minWidth: 140, minHeight: 48, backgroundColor: COLORS.amberDim, paddingVertical: 12, paddingHorizontal: 8, justifyContent: "center", alignItems: "center" },
  primaryText: { color: COLORS.textPrimary, fontFamily: mono, fontSize: 12, letterSpacing: 1, textAlign: "center" },
  secondary: { flex: 1, minWidth: 140, minHeight: 48, borderWidth: 1, borderColor: COLORS.amberDim, paddingVertical: 12, paddingHorizontal: 8, justifyContent: "center", alignItems: "center" },
  secondaryText: { color: COLORS.amberLight, fontFamily: mono, fontSize: 12, letterSpacing: 1, textAlign: "center" },
  form: { marginTop: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard, padding: 14 },
  tabs: { flexDirection: "row", borderWidth: 1, borderColor: COLORS.border },
  tab: { flex: 1, paddingVertical: 9, alignItems: "center" },
  tabActive: { backgroundColor: COLORS.amberDim },
  tabText: { fontSize: 11, color: COLORS.textMuted, fontFamily: mono },
  tabTextActive: { color: COLORS.textPrimary },
  label: { fontSize: 10, color: COLORS.textMuted, fontFamily: mono, letterSpacing: 1, marginTop: 12, marginBottom: 6, textTransform: "uppercase" },
  row: { flexDirection: "row", gap: 10 },
  col: { flex: 1, minWidth: 0 },
  input: { borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bg, color: COLORS.textPrimary, fontFamily: mono, padding: 10 },
  hint: { fontSize: 10, color: COLORS.textDim, fontFamily: mono, marginTop: 10, lineHeight: 15 },
  error: { fontSize: 11, color: COLORS.danger, fontFamily: mono, marginTop: 10 },
  empty: { fontSize: 12, color: COLORS.textMuted, fontFamily: mono, marginTop: 24, lineHeight: 18 },
  card: { marginTop: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard, padding: 14 },
  cardWarn: { borderColor: COLORS.danger },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 14, color: COLORS.textPrimary, fontFamily: mono, flex: 1 },
  badge: { fontSize: 10, color: COLORS.amberLight, fontFamily: mono, borderWidth: 1, borderColor: COLORS.amberDim, paddingHorizontal: 6, paddingVertical: 2 },
  meta: { fontSize: 11, color: COLORS.textMuted, fontFamily: mono, marginTop: 4 },
  warn: { fontSize: 11, color: COLORS.amberLight, fontFamily: mono, marginTop: 8 },
  cardActions: { flexDirection: "row", flexWrap: "wrap", gap: 18, marginTop: 12 },
  link: { fontSize: 11, color: COLORS.textSecondary, fontFamily: mono, marginTop: 4 },
  setRolls: { marginTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 8 },
  setRollsLabel: { fontSize: 9, color: COLORS.textDim, fontFamily: mono, letterSpacing: 1, textTransform: "uppercase" },
  more: { fontSize: 11, color: COLORS.amberLight, fontFamily: mono, marginTop: 6 },
});
