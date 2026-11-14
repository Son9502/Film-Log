import { useEffect, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Modal, Switch, StyleSheet,
} from "react-native";
import { COLORS } from "@/constants";
import { todayISO } from "@/utils";
import { LabDropoff } from "@/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type DropoffInput = Omit<LabDropoff, "id" | "createdAt" | "updatedAt">;

export default function LabDropoffModal({
  visible, onClose, onSubmit, onReuse, previousLabs, openDropoffs, lockDevelops, lockScans,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: DropoffInput) => void;
  onReuse: (dropoffId: string) => void;
  previousLabs: string[];
  openDropoffs: LabDropoff[];
  // When you already developed it yourself the lab can only scan; when it
  // needs developing the lab does that, with scanning optional.
  lockDevelops?: boolean;
  lockScans?: boolean;
}) {
  const [labName, setLabName] = useState("");
  const [droppedOffAt, setDroppedOffAt] = useState(todayISO());
  const [expectedPickupAt, setExpectedPickupAt] = useState("");
  const [cost, setCost] = useState("");
  const [labDevelops, setLabDevelops] = useState(true);
  const [labScans, setLabScans] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visible) return;
    setLabName(previousLabs[0] ?? "");
    setDroppedOffAt(todayISO());
    setExpectedPickupAt("");
    setCost("");
    setLabDevelops(!lockScans);
    setLabScans(!!lockScans);
    setNotes("");
    setError("");
  }, [visible, lockScans]);

  function submit() {
    const price = cost.trim() ? parseFloat(cost) : undefined;
    if (!labName.trim()) return setError("Enter the lab's name.");
    if (!DATE_RE.test(droppedOffAt)) return setError("Drop-off date must be YYYY-MM-DD.");
    if (expectedPickupAt && !DATE_RE.test(expectedPickupAt)) return setError("Pickup date must be YYYY-MM-DD.");
    if (price !== undefined && (isNaN(price) || price < 0)) return setError("Cost must be a positive number.");
    if (!labDevelops && !labScans) return setError("The lab must develop, scan, or both.");
    onSubmit({
      labName: labName.trim(),
      droppedOffAt,
      expectedPickupAt: expectedPickupAt || undefined,
      cost: price,
      labDevelops,
      labScans,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <ScrollView style={s.sheet} keyboardShouldPersistTaps="handled">
          <Text style={s.title}>Lab drop-off</Text>

          {openDropoffs.length > 0 && (
            <>
              <Text style={s.label}>Add to a drop-off still at the lab</Text>
              {openDropoffs.map((d) => (
                <TouchableOpacity key={d.id} style={s.existing} onPress={() => onReuse(d.id)}>
                  <Text style={s.existingName}>{d.labName}</Text>
                  <Text style={s.existingSub}>
                    Dropped off {d.droppedOffAt}
                    {" · "}{[d.labDevelops && "develops", d.labScans && "scans"].filter(Boolean).join(" + ")}
                  </Text>
                </TouchableOpacity>
              ))}
              <Text style={[s.label, { marginTop: 24 }]}>Or a new drop-off</Text>
            </>
          )}

          <Text style={s.label}>Lab</Text>
          <TextInput style={s.input} value={labName} onChangeText={setLabName} placeholder="e.g. The Darkroom" placeholderTextColor={COLORS.textDim} />
          {previousLabs.length > 0 && (
            <View style={s.chips}>
              {previousLabs.map((l) => (
                <TouchableOpacity key={l} style={[s.chip, labName === l && s.chipActive]} onPress={() => setLabName(l)}>
                  <Text style={s.chipText}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={s.label}>Dropped off (YYYY-MM-DD)</Text>
          <TextInput style={s.input} value={droppedOffAt} onChangeText={setDroppedOffAt} autoCapitalize="none" placeholderTextColor={COLORS.textDim} />

          <Text style={s.label}>Expected pickup (optional)</Text>
          <TextInput style={s.input} value={expectedPickupAt} onChangeText={setExpectedPickupAt} autoCapitalize="none" placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.textDim} />

          <Text style={s.label}>Cost (optional)</Text>
          <TextInput style={s.input} value={cost} onChangeText={setCost} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={COLORS.textDim} />

          <View style={s.toggleRow}>
            <Text style={s.toggleLabel}>Lab develops</Text>
            <Switch value={labDevelops} disabled={lockDevelops || lockScans} onValueChange={setLabDevelops}
              trackColor={{ false: COLORS.border, true: COLORS.amberDim }} thumbColor={labDevelops ? COLORS.amber : COLORS.textDim} />
          </View>
          <View style={s.toggleRow}>
            <Text style={s.toggleLabel}>Lab scans</Text>
            <Switch value={labScans} disabled={lockScans} onValueChange={setLabScans}
              trackColor={{ false: COLORS.border, true: COLORS.amberDim }} thumbColor={labScans ? COLORS.amber : COLORS.textDim} />
          </View>

          <Text style={s.label}>Notes (optional)</Text>
          <TextInput style={[s.input, { height: 70, textAlignVertical: "top" }]} value={notes} onChangeText={setNotes} multiline placeholderTextColor={COLORS.textDim} />

          {error !== "" && <Text style={s.error}>{error}</Text>}

          <TouchableOpacity style={s.saveBtn} onPress={submit}>
            <Text style={s.saveText}>Send to lab</Text>
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
  label: { fontSize: 9, color: COLORS.amber, letterSpacing: 2, textTransform: "uppercase", fontFamily: mono, marginBottom: 6, marginTop: 16 },
  input: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, color: COLORS.textPrimary, fontFamily: mono, fontSize: 13, paddingHorizontal: 12, paddingVertical: 10 },
  existing: { borderWidth: 1, borderColor: COLORS.amberDim, backgroundColor: COLORS.bgCard, padding: 12, marginBottom: 8 },
  existingName: { fontSize: 13, color: COLORS.textPrimary, fontFamily: mono },
  existingSub: { fontSize: 10, color: COLORS.textMuted, fontFamily: mono, marginTop: 3 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  chip: { borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 10, paddingVertical: 6 },
  chipActive: { borderColor: COLORS.amber, backgroundColor: COLORS.amberDim },
  chipText: { color: COLORS.textMuted, fontFamily: mono, fontSize: 11 },
  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 12, paddingVertical: 10, marginTop: 12 },
  toggleLabel: { fontSize: 13, color: COLORS.textPrimary, fontFamily: mono },
  error: { color: "#c0392b", fontFamily: mono, fontSize: 11, marginTop: 12 },
  saveBtn: { marginTop: 24, backgroundColor: COLORS.amber, paddingVertical: 14, alignItems: "center" },
  saveText: { color: COLORS.bg, fontFamily: mono, fontSize: 11, letterSpacing: 2, textTransform: "uppercase" },
  cancelBtn: { paddingVertical: 14, alignItems: "center", marginBottom: 20 },
  cancelText: { color: COLORS.textMuted, fontFamily: mono, fontSize: 11 },
});
