import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { COLORS } from "@/constants";
import { pushLabel } from "@/utils/devCalc";

/**
 * "Shot at ISO": the speed the roll is rated at. Rating above box speed means it will
 * need pushing in development, below means pulling. The batch screen reads this later.
 */
export default function ShotIsoField({
  boxIso, value, onChange, labelStyle, ageCompStops = 0,
}: {
  boxIso: number | undefined;
  /** What the user typed; empty means box speed. */
  value: string;
  onChange: (v: string) => void;
  labelStyle?: object;
  /** Extra exposure for expired film, already in the rating; not a pull. */
  ageCompStops?: number;
}) {
  const shot = parseInt(value, 10);
  const effective = Number.isFinite(shot) && shot > 0 ? shot : boxIso;
  const quick = boxIso ? [boxIso / 2, boxIso, boxIso * 2, boxIso * 4].map((n) => Math.round(n)) : [];

  return (
    <View>
      <Text style={labelStyle ?? s.label}>Shot at ISO</Text>
      <TextInput
        style={s.input}
        value={value}
        onChangeText={(v) => onChange(v.replace(/[^0-9]/g, ""))}
        keyboardType="number-pad"
        placeholder={boxIso ? `${boxIso} (box speed)` : "e.g. 400"}
        placeholderTextColor={COLORS.textDim}
      />
      {quick.length > 0 && (
        <View style={s.chips}>
          {quick.map((n) => (
            <TouchableOpacity key={n} style={[s.chip, effective === n && s.chipOn]} onPress={() => onChange(n === boxIso ? "" : String(n))}>
              <Text style={[s.chipText, effective === n && s.chipTextOn]}>{n}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {boxIso && effective ? <Text style={s.hint}>{pushLabel(boxIso, effective, ageCompStops)}</Text> : null}
    </View>
  );
}

const mono = "Courier New";
const s = StyleSheet.create({
  label: { fontSize: 9, color: COLORS.textMuted, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: mono, marginBottom: 6, marginTop: 16 },
  input: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, color: COLORS.textPrimary, fontFamily: mono, fontSize: 13, paddingHorizontal: 12, paddingVertical: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  chip: { borderWidth: 1, borderColor: COLORS.border, paddingVertical: 6, paddingHorizontal: 10 },
  chipOn: { borderColor: COLORS.amber, backgroundColor: COLORS.bgElevated },
  chipText: { color: COLORS.textMuted, fontFamily: mono, fontSize: 12 },
  chipTextOn: { color: COLORS.amberLight },
  hint: { color: COLORS.amberLight, fontFamily: mono, fontSize: 11, marginTop: 8 },
});
