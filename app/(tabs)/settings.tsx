import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { COLORS, SOCIAL_ENABLED } from "@/constants";
import { useFilmLogStore } from "@/store";
import { signOut } from "@/services/supabase";
import { buildXlsx } from "@/utils/exportXlsx";
import { saveBinaryFile, saveZipFile, XLSX_MIME } from "@/utils/exportFiles";
import { todayISO } from "@/utils";
import { buildScanArchive } from "@/utils/exportZip";
import { exportCurrentLocalSnapshot } from "@/utils/snapshotExport";
import SyncPanel from "@/components/SyncPanel";

export default function SettingsScreen() {
  const router = useRouter();
  const {
    user, clearUserData, rolls, cameras, filmStocks,
    temperatureUnit, distanceUnit, setTemperatureUnit, setDistanceUnit,
  } = useFilmLogStore();
  const [exportMsg, setExportMsg] = useState("");
  const [scanExportMsg, setScanExportMsg] = useState("");
  const [snapshotMsg, setSnapshotMsg] = useState("");

  const exportData = async () => {
    const names = {
      film: (id: string) => filmStocks.find((f) => f.id === id)?.name ?? id,
      camera: (id: string) => cameras.find((c) => c.id === id)?.name ?? id,
    };
    try {
      await saveBinaryFile(`filmlog-${todayISO()}.xlsx`, buildXlsx(rolls, names), XLSX_MIME);
      setExportMsg(`Exported ${rolls.length} rolls.`);
    } catch (e) {
      setExportMsg(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const exportScans = async () => {
    const names = {
      film: (id: string) => filmStocks.find((f) => f.id === id)?.name ?? id,
      camera: (id: string) => cameras.find((c) => c.id === id)?.name ?? id,
    };
    try {
      setScanExportMsg("Preparing archive…");
      const archive = await buildScanArchive(rolls, names);
      await saveZipFile("filmlog-scans.zip", archive.bytes);
      setScanExportMsg(`Exported ${archive.scanCount} scans with frame metadata.`);
    } catch (e) {
      setScanExportMsg(`Scan export failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const exportSnapshot = async () => {
    try {
      await exportCurrentLocalSnapshot();
      setSnapshotMsg("Download or share opened. Confirm the file was saved.");
    } catch (e) {
      console.error("Local snapshot export failed:", e);
      setSnapshotMsg(`Snapshot failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.container}>
      <Text style={s.sectionLabel}>Sync</Text>
      <SyncPanel />
      <View style={{ height: 24 }} />
      <Text style={s.sectionLabel}>General</Text>
      <TouchableOpacity style={s.row} onPress={() => router.push("/settings/gear")}>
        <View>
          <Text style={s.rowLabel}>My Gear</Text>
          <Text style={s.rowSub}>Cameras &amp; film stocks</Text>
        </View>
        <Text style={s.arrow}>›</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.row} onPress={exportData}>
        <View>
          <Text style={s.rowLabel}>Export Data (Spreadsheet)</Text>
          <Text style={s.rowSub}>{exportMsg || "One .xlsx: all rolls, all frames, and a sheet per roll"}</Text>
        </View>
        <Text style={s.arrow}>›</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.row} onPress={exportScans}>
        <View>
          <Text style={s.rowLabel}>Export Scans (ZIP)</Text>
          <Text style={s.rowSub}>{scanExportMsg || "Original scans with frame metadata"}</Text>
        </View>
        <Text style={s.arrow}>›</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.row} onPress={exportSnapshot}>
        <View style={{ flex: 1 }}>
          <Text style={s.rowLabel}>Export Local Snapshot (JSON)</Text>
          <Text style={s.rowSub}>{snapshotMsg || "Private device data only; scans not included. No in-app restore yet."}</Text>
        </View>
        <Text style={s.arrow}>›</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.row} onPress={() => router.push("/intro")}>
        <View>
          <Text style={s.rowLabel}>Show Intro</Text>
          <Text style={s.rowSub}>How Film Log works, in seven cards</Text>
        </View>
        <Text style={s.arrow}>›</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.row} onPress={() => router.push("/settings/stats")}>
        <View>
          <Text style={s.rowLabel}>Stats &amp; Badges</Text>
          <Text style={s.rowSub}>Overview &amp; achievements</Text>
        </View>
        <Text style={s.arrow}>›</Text>
      </TouchableOpacity>
      {SOCIAL_ENABLED && (
        <TouchableOpacity style={s.row} onPress={() => router.push("/settings/profile")}>
          <View>
            <Text style={s.rowLabel}>My Profile</Text>
            <Text style={s.rowSub}>Handle, bio &amp; public visibility</Text>
          </View>
          <Text style={s.arrow}>›</Text>
        </TouchableOpacity>
      )}

      <Text style={[s.sectionLabel, { marginTop: 28 }]}>Units</Text>
      <View style={s.unitRow}>
        <Text style={s.rowLabel}>Temperature</Text>
        <View style={s.unitChoices}>
          {(["C", "F"] as const).map((unit) => (
            <TouchableOpacity
              key={unit}
              style={[s.unitChoice, temperatureUnit === unit && s.unitChoiceOn]}
              onPress={() => setTemperatureUnit(unit)}
            >
              <Text style={[s.unitText, temperatureUnit === unit && s.unitTextOn]}>°{unit}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <View style={s.unitRow}>
        <Text style={s.rowLabel}>Distance</Text>
        <View style={s.unitChoices}>
          {(["km", "mi"] as const).map((unit) => (
            <TouchableOpacity
              key={unit}
              style={[s.unitChoice, distanceUnit === unit && s.unitChoiceOn]}
              onPress={() => setDistanceUnit(unit)}
            >
              <Text style={[s.unitText, distanceUnit === unit && s.unitTextOn]}>{unit}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Text style={[s.sectionLabel, { marginTop: 28 }]}>Account</Text>
      <View style={s.accountCard}>
        <Text style={s.accountFieldLabel}>Signed in as</Text>
        <Text style={s.accountEmail}>{user?.email}</Text>
      </View>
      <TouchableOpacity
        style={s.signOutBtn}
        onPress={async () => {
          await signOut();
          clearUserData();
        }}
      >
        <Text style={s.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  container: { padding: 20, paddingBottom: 40 },

  sectionLabel: {
    fontSize: 9, color: COLORS.amber, letterSpacing: 3,
    textTransform: "uppercase", fontFamily: "Courier New",
    marginBottom: 8, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },

  row: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle,
  },
  rowLabel: { fontSize: 13, color: COLORS.textPrimary, fontFamily: "Courier New" },
  rowSub: { fontSize: 12, color: COLORS.textMuted, fontFamily: "Courier New", marginTop: 2, flexShrink: 1 },
  arrow: { fontSize: 20, color: COLORS.textDim },
  unitRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle,
  },
  unitChoices: { flexDirection: "row", gap: 6 },
  unitChoice: { minWidth: 42, borderWidth: 1, borderColor: COLORS.border, paddingVertical: 6, alignItems: "center" },
  unitChoiceOn: { borderColor: COLORS.amber, backgroundColor: COLORS.bgCard },
  unitText: { fontSize: 10, color: COLORS.textMuted, fontFamily: "Courier New" },
  unitTextOn: { color: COLORS.amber },

  accountCard: {
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    padding: 14, marginBottom: 14,
  },
  accountFieldLabel: {
    fontSize: 14, color: COLORS.textSecondary, fontFamily: "Courier New",
    letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4,
  },
  accountEmail: { fontSize: 16, color: COLORS.textPrimary, fontFamily: "Courier New" },

  signOutBtn: {
    borderWidth: 1, borderColor: COLORS.danger,
    minHeight: 48, paddingVertical: 12, alignItems: "center", justifyContent: "center",
  },
  signOutText: {
    fontSize: 16, color: "#ff9588", fontFamily: "Courier New",
    letterSpacing: 2, textTransform: "uppercase",
  },
});
