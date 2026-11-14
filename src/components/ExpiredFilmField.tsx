import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { COLORS } from "@/constants";
import type { DevProcess } from "@/types";
import { todayISO } from "@/utils";
import { stopsText } from "@/utils/devCalc";
import {
  FilmStorage, MAX_COMP_STOPS, STORAGE_OPTIONS, expiryAdvice, formatAge, formatExpiry, isValidExpiry,
  rateSlower, roundCompStops,
} from "@/utils/expiredFilm";

/**
 * The film's expiry date and the extra exposure given for its age. Changing the
 * compensation re-rates "Shot at ISO" by the same amount, so any intended push or
 * pull is kept; development adds the compensation back.
 */
export default function ExpiredFilmField({
  boxIso, process, expiresAt, onExpiresAtChange, compStops, onCompChange, shotIso, onShotIsoChange, labelStyle,
}: {
  boxIso: number | undefined;
  process: DevProcess | null;
  expiresAt: string;
  /** Omit to show the date read-only (it comes from the inventory). */
  onExpiresAtChange?: (v: string) => void;
  compStops: number;
  onCompChange: (stops: number) => void;
  /** "Shot at ISO" as typed; empty means box speed. */
  shotIso: string;
  onShotIsoChange: (v: string) => void;
  labelStyle?: object;
}) {
  const [storage, setStorage] = useState<FilmStorage>("room");
  const advice = expiryAdvice({ expiresAt, today: todayISO(), boxIso, process, storage });
  const invalid = expiresAt.trim() !== "" && !isValidExpiry(expiresAt);

  function setComp(next: number) {
    const stops = roundCompStops(Math.min(MAX_COMP_STOPS, Math.max(0, next)));
    const typed = parseInt(shotIso, 10);
    const current = typed > 0 ? typed : boxIso;
    if (current && boxIso) {
      const rated = rateSlower(current, stops - compStops);
      onShotIsoChange(rated === boxIso ? "" : String(rated));
    }
    onCompChange(stops);
  }

  const showComp = !!advice || compStops > 0;

  return (
    <View>
      <Text style={labelStyle ?? s.label}>Film expiry{onExpiresAtChange ? " (optional)" : ""}</Text>
      {onExpiresAtChange ? (
        <>
          <TextInput
            style={s.input}
            value={expiresAt}
            onChangeText={onExpiresAtChange}
            autoCapitalize="none"
            placeholder="YYYY-MM-DD or YYYY-MM"
            placeholderTextColor={COLORS.textDim}
          />
          {invalid && <Text style={s.error}>Use YYYY-MM-DD or YYYY-MM.</Text>}
        </>
      ) : (
        <Text style={s.readOnly}>{expiresAt ? `${formatExpiry(expiresAt)} (from your stash)` : "Not recorded in your stash"}</Text>
      )}

      {advice && (
        <View style={s.panel}>
          <Text style={s.expired}>Expired {formatAge(advice.years)} ago.</Text>
          <Text style={s.small}>How was it stored?</Text>
          <View style={s.chips}>
            {STORAGE_OPTIONS.map((o) => (
              <TouchableOpacity key={o.id} style={[s.chip, storage === o.id && s.chipOn]} onPress={() => setStorage(o.id)}>
                <Text style={[s.chipText, storage === o.id && s.chipTextOn]}>{o.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {advice.stops > 0 ? (
            <View style={s.suggestRow}>
              <Text style={s.suggest}>
                Suggested: {stopsText(advice.stops)}
                {advice.ratedIso ? ` (rate box speed at ISO ${advice.ratedIso})` : ""}
              </Text>
              {compStops !== advice.stops && (
                <TouchableOpacity style={s.apply} onPress={() => setComp(advice.stops)}>
                  <Text style={s.applyText}>Apply</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <Text style={s.suggest}>Under ⅓ stop of ageing: shoot at box speed.</Text>
          )}
          {advice.notes.map((n) => <Text key={n} style={s.small}>{n}</Text>)}
          <Text style={s.small}>About +1 stop per decade past expiry is a rule of thumb, not a datasheet value.</Text>
        </View>
      )}

      {showComp && (
        <View style={s.stepRow}>
          <Text style={s.stepLabel}>Extra exposure for age</Text>
          <View style={s.stepper}>
            <TouchableOpacity style={s.stepBtn} disabled={compStops <= 0} onPress={() => setComp(compStops - 1 / 3)}>
              <Text style={[s.stepBtnText, compStops <= 0 && s.dim]}>−</Text>
            </TouchableOpacity>
            <Text style={s.stepValue}>{compStops > 0 ? stopsText(compStops) : "None"}</Text>
            <TouchableOpacity style={s.stepBtn} disabled={compStops >= MAX_COMP_STOPS} onPress={() => setComp(compStops + 1 / 3)}>
              <Text style={[s.stepBtnText, compStops >= MAX_COMP_STOPS && s.dim]}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const mono = "Courier New";
const s = StyleSheet.create({
  label: { fontSize: 9, color: COLORS.textMuted, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: mono, marginBottom: 6, marginTop: 16 },
  input: { backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, color: COLORS.textPrimary, fontFamily: mono, fontSize: 13, paddingHorizontal: 12, paddingVertical: 10 },
  readOnly: { color: COLORS.textSecondary, fontFamily: mono, fontSize: 12 },
  error: { color: "#c0392b", fontFamily: mono, fontSize: 11, marginTop: 6 },
  panel: { borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard, padding: 12, marginTop: 8, gap: 6 },
  expired: { color: "#c0392b", fontFamily: mono, fontSize: 12 },
  small: { color: COLORS.textMuted, fontFamily: mono, fontSize: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: COLORS.border, paddingVertical: 6, paddingHorizontal: 10 },
  chipOn: { borderColor: COLORS.amber, backgroundColor: COLORS.bgElevated },
  chipText: { color: COLORS.textMuted, fontFamily: mono, fontSize: 11 },
  chipTextOn: { color: COLORS.amberLight },
  suggestRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  suggest: { color: COLORS.amberLight, fontFamily: mono, fontSize: 12, flexShrink: 1 },
  apply: { backgroundColor: COLORS.amber, paddingVertical: 6, paddingHorizontal: 12 },
  applyText: { color: COLORS.bg, fontFamily: mono, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase" },
  stepRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 },
  stepLabel: { color: COLORS.textSecondary, fontFamily: mono, fontSize: 12 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 6 },
  stepBtn: { borderWidth: 1, borderColor: COLORS.border, width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  stepBtnText: { color: COLORS.textPrimary, fontFamily: mono, fontSize: 16 },
  stepValue: { color: COLORS.textPrimary, fontFamily: mono, fontSize: 12, minWidth: 80, textAlign: "center" },
  dim: { opacity: 0.3 },
});
