import { useEffect, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Modal, Switch, StyleSheet,
} from "react-native";
import { COLORS } from "@/constants";
import { HelpLabel } from "@/components/HelpHint";
import { HELP } from "@/utils/help";
import { todayISO } from "@/utils";
import { formatStops, parseDuration } from "@/utils/chemistry";
import { developmentStops } from "@/utils/devCalc";
import { displayStoredTemperature, storedTemperature, TemperatureUnit } from "@/utils/units";
import type { Roll } from "@/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type DevelopedDetails = Pick<
  Roll, "developedAt" | "developer" | "dilution" | "devTime" | "devTemp" | "pushPull" | "fixer" | "photoFlo"
>;

/**
 * Shown when a roll you developed yourself (outside a batch) moves on to scanning.
 * Lets you log how it was developed, hand it to a batch instead, or skip.
 */
export default function DevelopedModal({
  visible, roll, boxIso, temperatureUnit, onClose, onSave, onAddToBatch,
}: {
  visible: boolean;
  roll: Roll;
  /** The film's box speed, to suggest push/pull from the roll's Shot at ISO. */
  boxIso?: number;
  temperatureUnit: TemperatureUnit;
  onClose: () => void;
  onSave: (details: DevelopedDetails) => void;
  onAddToBatch: () => void;
}) {
  const [developedAt, setDevelopedAt] = useState(todayISO());
  const [developer, setDeveloper] = useState("");
  const [dilution, setDilution] = useState("");
  const [devTime, setDevTime] = useState("");
  const [devTemp, setDevTemp] = useState("");
  const [pushPull, setPushPull] = useState("");
  const [fixer, setFixer] = useState("");
  const [photoFlo, setPhotoFlo] = useState(true);
  const [error, setError] = useState("");
  const shotIso = parseInt(roll.iso, 10);
  // Nearest third of a stop, written as a number the push/pull box accepts (e.g. +2, +1.3).
  const suggestedPush = boxIso && shotIso > 0
    ? formatStops(Math.round((Math.round(developmentStops(boxIso, shotIso, roll.expiryCompStops) * 3) / 3) * 10) / 10)
    : undefined;

  useEffect(() => {
    if (!visible) return;
    setDevelopedAt(roll.developedAt ?? todayISO());
    setDeveloper(roll.developer ?? "");
    setDilution(roll.dilution ?? "");
    setDevTime(roll.devTime ?? "");
    setDevTemp(displayStoredTemperature(roll.devTemp, temperatureUnit) ?? "");
    setPushPull(roll.pushPull ?? suggestedPush ?? "");
    setFixer(roll.fixer ?? "");
    setPhotoFlo(roll.photoFlo ?? true);
    setError("");
  }, [visible, roll.id]);

  function submit() {
    if (!DATE_RE.test(developedAt)) return setError("Date developed must be YYYY-MM-DD.");
    if (devTime.trim() && parseDuration(devTime) == null) return setError("Enter the time as m:ss, e.g. 8:30.");
    if (pushPull.trim() && !/^[+-]?\d+(\.\d+)?$/.test(pushPull.trim())) return setError("Push/pull is stops, e.g. +1 or -1.");
    onSave({
      developedAt,
      developer: developer.trim() || undefined,
      dilution: dilution.trim() || undefined,
      devTime: devTime.trim() || undefined,
      devTemp: devTemp.trim() ? storedTemperature(devTemp, temperatureUnit) : undefined,
      pushPull: pushPull.trim() || undefined,
      fixer: fixer.trim() || undefined,
      photoFlo,
    });
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <ScrollView style={s.sheet} keyboardShouldPersistTaps="handled">
          <Text style={s.title}>How did you develop it?</Text>
          <Text style={s.sub}>
            Log the details for this roll, or add it to a batch if you developed it with other rolls.
          </Text>

          <TouchableOpacity style={s.batchBtn} onPress={onAddToBatch}>
            <Text style={s.batchText}>Add to a batch instead ›</Text>
          </TouchableOpacity>

          <Text style={s.label}>Date developed</Text>
          <TextInput style={s.input} value={developedAt} onChangeText={setDevelopedAt} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.textDim} />

          <Text style={s.label}>Developer</Text>
          <TextInput style={s.input} value={developer} onChangeText={setDeveloper} placeholder="e.g. Kodak D-76" placeholderTextColor={COLORS.textDim} />

          <View style={s.row}>
            <View style={s.col}>
              <Text style={s.label}>Dilution</Text>
              <TextInput style={s.input} value={dilution} onChangeText={setDilution} placeholder="e.g. 1+1" placeholderTextColor={COLORS.textDim} />
            </View>
            <View style={s.col}>
              <HelpLabel style={s.label} text={HELP.pushPull}>Push / pull</HelpLabel>
              <TextInput style={s.input} value={pushPull} onChangeText={setPushPull} placeholder="e.g. +1" placeholderTextColor={COLORS.textDim} />
            </View>
          </View>
          {suggestedPush && !roll.pushPull ? (
            <Text style={s.sub}>Push/pull filled in from shooting at ISO {roll.iso} (box speed {boxIso}).</Text>
          ) : null}

          <View style={s.row}>
            <View style={s.col}>
              <Text style={s.label}>Time (m:ss)</Text>
              <TextInput style={s.input} value={devTime} onChangeText={setDevTime} placeholder="8:30" placeholderTextColor={COLORS.textDim} />
            </View>
            <View style={s.col}>
              <Text style={s.label}>Temp °{temperatureUnit}</Text>
              <TextInput style={s.input} value={devTemp} onChangeText={setDevTemp} keyboardType="decimal-pad" placeholder={temperatureUnit === "F" ? "68" : "20"} placeholderTextColor={COLORS.textDim} />
            </View>
          </View>

          <Text style={s.label}>Fixer</Text>
          <TextInput style={s.input} value={fixer} onChangeText={setFixer} placeholder="e.g. Ilford Rapid Fixer" placeholderTextColor={COLORS.textDim} />

          <View style={s.toggleRow}>
            <Text style={s.toggleLabel}>Wetting agent used</Text>
            <Switch
              value={photoFlo}
              onValueChange={setPhotoFlo}
              trackColor={{ false: COLORS.border, true: COLORS.amberDim }}
              thumbColor={photoFlo ? COLORS.amber : COLORS.textDim}
            />
          </View>

          {error ? <Text style={s.error}>{error}</Text> : null}
          <TouchableOpacity style={s.saveBtn} onPress={submit}>
            <Text style={s.saveText}>Save → In Scanning</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
            <Text style={s.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const mono = "Courier New";
const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  sheet: { backgroundColor: COLORS.bgElevated, maxHeight: "90%", padding: 20 },
  title: { fontSize: 12, color: COLORS.textPrimary, fontFamily: mono, letterSpacing: 3, textTransform: "uppercase" },
  sub: { fontSize: 11, color: COLORS.textMuted, fontFamily: mono, marginTop: 8, lineHeight: 16 },
  batchBtn: { marginTop: 14, borderWidth: 1, borderColor: COLORS.amberDim, paddingVertical: 11, alignItems: "center" },
  batchText: { color: COLORS.amberLight, fontFamily: mono, fontSize: 12 },
  label: { fontSize: 9, color: COLORS.amber, letterSpacing: 2, textTransform: "uppercase", fontFamily: mono, marginBottom: 6, marginTop: 16 },
  input: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, color: COLORS.textPrimary, fontFamily: mono, fontSize: 13, paddingHorizontal: 12, paddingVertical: 10 },
  row: { flexDirection: "row", gap: 10 },
  col: { flex: 1, minWidth: 0 },
  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 12, paddingVertical: 10, marginTop: 16 },
  toggleLabel: { fontSize: 13, color: COLORS.textPrimary, fontFamily: mono },
  error: { color: COLORS.danger, fontFamily: mono, fontSize: 11, marginTop: 12 },
  saveBtn: { marginTop: 24, backgroundColor: COLORS.amber, paddingVertical: 14, alignItems: "center" },
  saveText: { color: COLORS.bg, fontFamily: mono, fontSize: 11, letterSpacing: 2, textTransform: "uppercase" },
  cancelBtn: { paddingVertical: 14, alignItems: "center", marginBottom: 20 },
  cancelText: { color: COLORS.textMuted, fontFamily: mono, fontSize: 11 },
});
