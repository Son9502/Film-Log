import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { COLORS } from "@/constants";
import { useFilmLogStore } from "@/store";
import { formatSyncValue } from "@/utils/rollSyncComparison";
import { countPending, SyncConflict } from "@/utils/rollMerge";

const FIELD_LABELS: Record<string, string> = {
  film_stock_id: "Film", camera_id: "Camera", frame_count: "Frame count", loaded_at: "Loaded",
  lab_at: "At lab since", lab_dropoff_id: "Lab drop-off", backed_up_at: "Backup checked", backed_up_count: "Scans backed up",
  developed_at: "Developed", location_label: "Location", dev_time: "Dev time", dev_temp: "Dev temp",
  push_pull: "Push/pull", photo_flo: "Wetting agent", is_public: "Public", scan_uri: "Scan",
};
const label = (name: string) => FIELD_LABELS[name] ?? name.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

const REASONS: Record<SyncConflict["reason"], string> = {
  "edited-both": "Changed on this device and on another device since the last sync.",
  "first-sync": "This device and the cloud had different copies before conflict-safe sync was turned on.",
  "deleted-elsewhere": "Deleted on another device, but changed here since.",
};

function timeAgo(iso?: string): string {
  if (!iso) return "never";
  const s = Math.round((Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  return new Date(iso).toLocaleString();
}

export default function SyncPanel() {
  const { user, rolls, rollSync, rollSyncMeta, syncConflicts, runRollSync, resolveSyncConflict } = useFilmLogStore();
  const pending = countPending(rolls, rollSyncMeta);

  if (!user) {
    return <Text style={s.sub}>Sign in to sync rolls between your phone and the web.</Text>;
  }

  const status =
    rollSync.state === "syncing" ? "Syncing…" :
    rollSync.state === "offline" ? "Offline: changes are saved on this device and will sync when you're back online." :
    rollSync.state === "setup-needed" ? "Not set up: run supabase/13, 14 and 15 in the Supabase SQL Editor, then tap Sync now." :
    rollSync.state === "error" ? `Problem: ${rollSync.error ?? "unknown error"}` :
    `Up to date · last synced ${timeAgo(rollSync.lastSyncedAt)}`;

  return (
    <View>
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>Rolls &amp; frames</Text>
          <Text style={[s.sub, (rollSync.state === "error" || rollSync.state === "setup-needed") && s.warn]}>{status}</Text>
          {pending > 0 && rollSync.state !== "syncing" && (
            <Text style={s.sub}>{pending} change{pending === 1 ? "" : "s"} waiting to sync.</Text>
          )}
        </View>
        <TouchableOpacity style={s.syncBtn} disabled={rollSync.state === "syncing"} onPress={() => void runRollSync()}>
          <Text style={s.syncText}>Sync now</Text>
        </TouchableOpacity>
      </View>

      {syncConflicts.length > 0 && (
        <Text style={[s.sub, s.warn, { marginTop: 10 }]}>
          {syncConflicts.length} change{syncConflicts.length === 1 ? "" : "s"} need your choice. Nothing is lost until you choose.
        </Text>
      )}
      {syncConflicts.map((c) => (
        <ConflictCard key={`${c.kind}:${c.id}`} conflict={c} rolls={rolls} onResolve={resolveSyncConflict} />
      ))}
    </View>
  );
}

function ConflictCard({
  conflict, rolls, onResolve,
}: {
  conflict: SyncConflict;
  rolls: ReturnType<typeof useFilmLogStore.getState>["rolls"];
  onResolve: (c: SyncConflict, choice: "local" | "remote" | Record<string, "local" | "remote">) => void;
}) {
  const [choices, setChoices] = useState<Record<string, "local" | "remote">>({});
  const roll = rolls.find((r) => r.id === conflict.rollId);
  const frame = conflict.kind === "frame" ? roll?.shots.find((sh) => sh.id === conflict.id) : undefined;
  const title = `${roll?.name?.trim() || "Untitled roll"}${frame ? ` · frame ${frame.frame}` : ""}`;

  if (conflict.reason === "deleted-elsewhere") {
    return (
      <View style={s.card}>
        <Text style={s.label}>{title}</Text>
        <Text style={s.sub}>{REASONS[conflict.reason]}</Text>
        <View style={s.actions}>
          <TouchableOpacity style={s.choice} onPress={() => onResolve(conflict, "local")}>
            <Text style={s.choiceText}>Keep my copy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.choice} onPress={() => onResolve(conflict, "remote")}>
            <Text style={s.choiceText}>Delete it here too</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={s.card}>
      <Text style={s.label}>{title}</Text>
      <Text style={s.sub}>{REASONS[conflict.reason]} Pick the value to keep for each field.</Text>
      {conflict.fields.map((f) => {
        const pick = choices[f.name] ?? "local";
        return (
          <View key={f.name} style={s.field}>
            <Text style={s.fieldName}>{label(f.name)}</Text>
            <View style={s.actions}>
              <TouchableOpacity style={[s.choice, pick === "local" && s.choiceOn]} onPress={() => setChoices((c) => ({ ...c, [f.name]: "local" }))}>
                <Text style={s.choiceTag}>This device</Text>
                <Text style={s.choiceText} numberOfLines={3}>{formatSyncValue(f.local)}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.choice, pick === "remote" && s.choiceOn]} onPress={() => setChoices((c) => ({ ...c, [f.name]: "remote" }))}>
                <Text style={s.choiceTag}>Other device</Text>
                <Text style={s.choiceText} numberOfLines={3}>{formatSyncValue(f.remote)}</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
      <TouchableOpacity style={s.apply} onPress={() => onResolve(conflict, choices)}>
        <Text style={s.applyText}>Keep these and sync</Text>
      </TouchableOpacity>
    </View>
  );
}

const mono = "Courier New";
const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle },
  label: { fontSize: 13, color: COLORS.textPrimary, fontFamily: mono },
  sub: { fontSize: 12, color: COLORS.textMuted, fontFamily: mono, marginTop: 3, lineHeight: 17 },
  warn: { color: COLORS.amberLight },
  syncBtn: { borderWidth: 1, borderColor: COLORS.amberDim, paddingVertical: 8, paddingHorizontal: 12 },
  syncText: { color: COLORS.amberLight, fontFamily: mono, fontSize: 11 },
  card: { marginTop: 12, borderWidth: 1, borderColor: COLORS.amberDim, backgroundColor: COLORS.bgCard, padding: 12 },
  field: { marginTop: 12 },
  fieldName: { fontSize: 10, color: COLORS.textDim, fontFamily: mono, letterSpacing: 1, textTransform: "uppercase" },
  actions: { flexDirection: "row", gap: 8, marginTop: 6 },
  choice: { flex: 1, minWidth: 0, borderWidth: 1, borderColor: COLORS.border, padding: 8 },
  choiceOn: { borderColor: COLORS.amber, backgroundColor: COLORS.bgElevated },
  choiceTag: { fontSize: 9, color: COLORS.textDim, fontFamily: mono, textTransform: "uppercase", letterSpacing: 1 },
  choiceText: { fontSize: 12, color: COLORS.textPrimary, fontFamily: mono, marginTop: 2 },
  apply: { marginTop: 14, backgroundColor: COLORS.amberDim, paddingVertical: 10, alignItems: "center" },
  applyText: { color: COLORS.textPrimary, fontFamily: mono, fontSize: 12 },
});
