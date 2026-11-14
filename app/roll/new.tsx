import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, Modal, FlatList, StyleSheet, Switch,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useFilmLogStore } from "@/store";
import { COLORS, FRAME_COUNT_OPTIONS } from "@/constants";
import { uid, todayISO, rollsRemaining, hasDuplicateRollName } from "@/utils";
import ShotIsoField from "@/components/ShotIsoField";
import ExpiredFilmField from "@/components/ExpiredFilmField";
import { stockProcess } from "@/utils/filmMatch";
import { isValidExpiry } from "@/utils/expiredFilm";
import Dropdown from "@/components/Dropdown";
import { backOrReplace } from "@/utils/navigation";

// ── Generic picker modal ──────────────────────────────────────────────────────

function PickerModal<T extends { id: string; name: string }>({
  visible,
  title,
  items,
  selectedId,
  onSelect,
  onClose,
  renderSub,
}: {
  visible: boolean;
  title: string;
  items: T[];
  selectedId: string;
  onSelect: (item: T) => void;
  onClose: () => void;
  renderSub?: (item: T) => string;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={m.overlay}>
        <View style={m.sheet}>
          <Text style={m.sheetTitle}>{title}</Text>
          <FlatList
            data={items}
            keyExtractor={(i) => i.id}
            style={{ maxHeight: 340 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[m.option, item.id === selectedId && m.optionSelected]}
                onPress={() => { onSelect(item); onClose(); }}
              >
                <Text style={[m.optionText, item.id === selectedId && m.optionTextSelected]}>
                  {item.name}
                </Text>
                {renderSub && (
                  <Text style={m.optionSub}>{renderSub(item)}</Text>
                )}
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity style={m.cancelBtn} onPress={onClose}>
            <Text style={m.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── New Roll Screen ───────────────────────────────────────────────────────────

export default function NewRollScreen() {
  const router = useRouter();
  const { purchaseId } = useLocalSearchParams<{ purchaseId?: string }>();
  const { rolls, cameras, filmStocks, purchases, addRoll, loadRollFromPurchase } = useFilmLogStore();
  const available = purchases.filter((p) => rollsRemaining(p) > 0);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState(
    available.find((p) => p.id === purchaseId)?.id ?? available[0]?.id ?? ""
  );
  const [skipInventory, setSkipInventory] = useState(false);
  const purchase = skipInventory ? undefined : available.find((p) => p.id === selectedPurchaseId);

  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [cameraId, setCameraId] = useState(cameras[0]?.id ?? "");
  const [filmStockId, setFilmStockId] = useState(purchase?.filmStockId ?? filmStocks[0]?.id ?? "");
  const stockName = (id: string) => filmStocks.find((f) => f.id === id)?.name ?? "Unknown film";
  const [shotIso, setShotIso] = useState(""); // empty = box speed
  const [manualExpiry, setManualExpiry] = useState(""); // for film not from the inventory
  const [compStops, setCompStops] = useState(0); // extra exposure for the film's age
  const expiresAt = purchase ? purchase.expiresAt ?? "" : manualExpiry;
  /** A different film: start again at box speed with no age compensation. */
  const resetRating = () => { setShotIso(""); setCompStops(0); };
  const [frameCount, setFrameCount] = useState(36);
  const [customFrames, setCustomFrames] = useState("");
  const [useCustomFrames, setUseCustomFrames] = useState(false);

  const [isPublic, setIsPublic] = useState(false);
  const [cameraPickerOpen, setCameraPickerOpen] = useState(false);

  const selectedCamera = cameras.find((c) => c.id === cameraId);
  const selectedFilm = filmStocks.find((f) => f.id === filmStockId);

  const resolvedFrameCount = useCustomFrames ? (parseInt(customFrames) || 0) : frameCount;

  function handleSubmit() {
    if (resolvedFrameCount <= 0) return;
    if (!purchase && manualExpiry.trim() && !isValidExpiry(manualExpiry)) return;
    const roll = {
      id: uid(),
      name: name.trim() || undefined,
      cameraId,
      filmStockId,
      iso: (parseInt(shotIso, 10) > 0 ? shotIso : selectedFilm?.iso.toString()) ?? "400",
      notes: notes.trim() || undefined,
      expiresAt: expiresAt.trim() || undefined,
      expiryCompStops: compStops || undefined,
      frameCount: resolvedFrameCount,
      status: "Shooting" as const,
      shots: [],
      isPublic,
      loadedAt: todayISO(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as const;
    if (purchase) loadRollFromPurchase(purchase.id, { ...roll, shots: [] });
    else addRoll({ ...roll, shots: [] });
    backOrReplace(router, "/(tabs)");
  }

  if (available.length === 0 && !skipInventory) {
    return (
      <View style={[s.container, s.content, { justifyContent: "center" }]}>
        <Text style={s.emptyTitle}>No film in stock</Text>
        <Text style={s.emptySub}>Add what you've bought to your inventory, then load a roll from it.</Text>
        <TouchableOpacity style={s.submitBtn} onPress={() => router.replace("/(tabs)/inventory")}>
          <Text style={s.submitText}>Add film to inventory</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ alignItems: "center", marginTop: 20 }} onPress={() => setSkipInventory(true)}>
          <Text style={s.skipText}>Log a roll without inventory</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

      {/* Inventory source */}
      {purchase && (
        <>
          <Text style={s.label}>Load from inventory</Text>
          <Dropdown
            items={available.map((p) => ({
              id: p.id,
              label: stockName(p.filmStockId),
              sub: `${rollsRemaining(p)} left${p.expiresAt ? ` · exp ${p.expiresAt}` : ""}`,
            }))}
            selectedId={purchase.id}
            onSelect={(i) => {
              setSelectedPurchaseId(i.id);
              const p = available.find((x) => x.id === i.id);
              if (p) { setFilmStockId(p.filmStockId); resetRating(); }
            }}
          />
          <TouchableOpacity onPress={() => { setSkipInventory(true); resetRating(); }}>
            <Text style={[s.skipText, { marginTop: 8 }]}>Not from inventory</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Roll Name */}
      <Text style={s.label}>Roll Name (optional)</Text>
      <TextInput
        style={s.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g. Yosemite Trip"
        placeholderTextColor={COLORS.textDim}
      />
      {hasDuplicateRollName(name, rolls) && (
        <Text style={s.nameWarning}>Another roll has this name. You can still create a separate roll.</Text>
      )}

      {/* Camera */}
      <Text style={s.label}>Camera</Text>
      <TouchableOpacity style={s.picker} onPress={() => setCameraPickerOpen(true)}>
        <Text style={s.pickerText}>{selectedCamera?.name ?? "Select camera"}</Text>
        <Text style={s.pickerArrow}>›</Text>
      </TouchableOpacity>

      {/* Film Stock */}
      <Text style={s.label}>Film Stock</Text>
      {purchase ? (
        <View style={s.picker}>
          <View>
            <Text style={s.pickerText}>{selectedFilm?.name ?? "Unknown film"}</Text>
            {selectedFilm && <Text style={s.pickerSub}>ISO {selectedFilm.iso}</Text>}
          </View>
        </View>
      ) : (
        <Dropdown
          items={filmStocks.map((f) => ({ id: f.id, label: f.name, sub: `ISO ${f.iso}` }))}
          selectedId={filmStockId}
          onSelect={(i) => { setFilmStockId(i.id); resetRating(); }}
          placeholder="Select film stock"
        />
      )}
      <ExpiredFilmField
        boxIso={selectedFilm?.iso}
        process={stockProcess(selectedFilm)}
        expiresAt={expiresAt}
        onExpiresAtChange={purchase ? undefined : setManualExpiry}
        compStops={compStops}
        onCompChange={setCompStops}
        shotIso={shotIso}
        onShotIsoChange={setShotIso}
        labelStyle={s.label}
      />
      <ShotIsoField boxIso={selectedFilm?.iso} value={shotIso} onChange={setShotIso} labelStyle={s.label} ageCompStops={compStops} />

      {/* Frame Count */}
      <Text style={s.label}>Frame Count</Text>
      <View style={s.segmented}>
        {FRAME_COUNT_OPTIONS.map((n) => (
          <TouchableOpacity
            key={n}
            style={[s.segment, !useCustomFrames && frameCount === n && s.segmentActive]}
            onPress={() => { setFrameCount(n); setUseCustomFrames(false); }}
          >
            <Text style={[s.segmentText, !useCustomFrames && frameCount === n && s.segmentTextActive]}>
              {n}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[s.segment, useCustomFrames && s.segmentActive]}
          onPress={() => setUseCustomFrames(true)}
        >
          <Text style={[s.segmentText, useCustomFrames && s.segmentTextActive]}>Other</Text>
        </TouchableOpacity>
      </View>
      {useCustomFrames && (
        <TextInput
          style={[s.input, { marginTop: 8 }]}
          value={customFrames}
          onChangeText={setCustomFrames}
          placeholder="e.g. 27"
          placeholderTextColor={COLORS.textDim}
          keyboardType="number-pad"
        />
      )}

      {/* Notes */}
      <Text style={s.label}>Notes (optional)</Text>
      <TextInput
        style={[s.input, s.inputMulti]}
        value={notes}
        onChangeText={setNotes}
        placeholder="Any notes about this roll..."
        placeholderTextColor={COLORS.textDim}
        multiline
        numberOfLines={3}
      />

      {/* Visibility */}
      <Text style={s.label}>Visibility</Text>
      <View style={s.toggleRow}>
        <View>
          <Text style={s.toggleLabel}>Public roll</Text>
          <Text style={s.toggleSub}>Visible to others on your public profile</Text>
        </View>
        <Switch
          value={isPublic}
          onValueChange={setIsPublic}
          trackColor={{ false: COLORS.border, true: COLORS.amberDim }}
          thumbColor={isPublic ? COLORS.amber : COLORS.textDim}
        />
      </View>

      {/* Submit */}
      <TouchableOpacity style={s.submitBtn} onPress={handleSubmit}>
        <Text style={s.submitText}>{purchase ? "Load Roll" : "Add Roll"}</Text>
      </TouchableOpacity>

      {/* Pickers */}
      <PickerModal
        visible={cameraPickerOpen}
        title="Select Camera"
        items={cameras}
        selectedId={cameraId}
        onSelect={(c) => setCameraId(c.id)}
        onClose={() => setCameraPickerOpen(false)}
      />

    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 20, paddingBottom: 60 },
  label: {
    fontSize: 9, color: COLORS.amber, letterSpacing: 2,
    textTransform: "uppercase", fontFamily: "Courier New",
    marginBottom: 6, marginTop: 20,
  },
  input: {
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    color: COLORS.textPrimary, fontFamily: "Courier New", fontSize: 13,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  inputMulti: { height: 80, textAlignVertical: "top" },
  nameWarning: { color: COLORS.amber, fontFamily: "Courier New", fontSize: 11, marginTop: 6 },
  picker: {
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 12, paddingVertical: 10,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  pickerText: { fontSize: 13, color: COLORS.textPrimary, fontFamily: "Courier New" },
  pickerSub: { fontSize: 10, color: COLORS.textMuted, fontFamily: "Courier New", marginTop: 2 },
  pickerArrow: { fontSize: 20, color: COLORS.textDim },
  segmented: { flexDirection: "row", gap: 8 },
  segment: {
    flex: 1, paddingVertical: 10, alignItems: "center",
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard,
  },
  segmentActive: { borderColor: COLORS.amber, backgroundColor: COLORS.amberDim },
  segmentText: { fontSize: 13, color: COLORS.textMuted, fontFamily: "Courier New" },
  segmentTextActive: { color: COLORS.textPrimary },
  toggleRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 12, paddingVertical: 12, marginTop: 0,
  },
  toggleLabel: { fontSize: 13, color: COLORS.textPrimary, fontFamily: "Courier New" },
  toggleSub: { fontSize: 9, color: COLORS.textMuted, fontFamily: "Courier New", marginTop: 2 },
  emptyTitle: { fontSize: 16, color: COLORS.textPrimary, fontFamily: "Courier New", textAlign: "center" },
  emptySub: { fontSize: 11, color: COLORS.textMuted, fontFamily: "Courier New", textAlign: "center", marginTop: 8 },
  skipText: { fontSize: 10, color: COLORS.textMuted, fontFamily: "Courier New", letterSpacing: 1, textDecorationLine: "underline" },
  submitBtn: {
    marginTop: 32, backgroundColor: COLORS.amber,
    paddingVertical: 14, alignItems: "center",
  },
  submitText: {
    fontSize: 11, color: COLORS.bg, fontFamily: "Courier New",
    letterSpacing: 2, textTransform: "uppercase",
  },
});

const m = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: COLORS.bgElevated, borderTopWidth: 1,
    borderTopColor: COLORS.border, paddingTop: 20, paddingBottom: 32,
  },
  sheetTitle: {
    fontSize: 9, color: COLORS.amber, letterSpacing: 3, textTransform: "uppercase",
    fontFamily: "Courier New", paddingHorizontal: 20, marginBottom: 12,
  },
  option: {
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle,
  },
  optionSelected: { backgroundColor: COLORS.bgCard },
  optionText: { fontSize: 13, color: COLORS.textSecondary, fontFamily: "Courier New" },
  optionTextSelected: { color: COLORS.amber },
  optionSub: { fontSize: 10, color: COLORS.textMuted, fontFamily: "Courier New", marginTop: 2 },
  cancelBtn: { marginTop: 8, paddingVertical: 14, alignItems: "center" },
  cancelText: { fontSize: 11, color: COLORS.textMuted, fontFamily: "Courier New", letterSpacing: 1 },
});
