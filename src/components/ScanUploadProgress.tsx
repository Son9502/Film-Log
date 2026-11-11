import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { COLORS } from "@/constants";

function WaitingMessage({ currentFile, processed }: { currentFile?: string; processed: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    setElapsed(0);
    const timer = setInterval(() => setElapsed((seconds) => seconds + 1), 1000);
    return () => clearInterval(timer);
  }, [currentFile, processed]);
  return (
    <>
      <Text style={styles.hint}>
        Waiting for this scan to finish ({elapsed}s). The bar updates after each file, not while it transfers. Keep this page open.
      </Text>
      {elapsed >= 30 && <Text style={styles.hint}>Large scans may take time. If this continues, check your connection and storage limits; the timer does not confirm the upload is active.</Text>}
    </>
  );
}

export default function ScanUploadProgress({ uploaded, failed, total, currentFile }: {
  uploaded: number;
  failed: number;
  total: number;
  currentFile?: string;
}) {
  const processed = uploaded + failed;
  const percent = total > 0 ? Math.round((processed / total) * 100) : 0;
  return (
    <View style={styles.container}>
      <ActivityIndicator color={COLORS.amberLight} size="large" />
      <Text style={styles.title}>Uploading scans</Text>
      <View
        style={styles.track}
        accessibilityRole="progressbar"
        accessibilityLabel="Scans processed"
        accessibilityValue={{ min: 0, max: total, now: processed, text: `${processed} of ${total} scans processed` }}
      >
        <View style={[styles.fill, { width: `${percent}%` }]} />
      </View>
      <Text style={styles.count}>{processed} / {total} scans processed ({percent}%)</Text>
      <Text style={styles.details}>
        {uploaded} uploaded{failed > 0 ? ` · ${failed} failed` : ""}
      </Text>
      {currentFile && <Text style={styles.current}>Current file: {currentFile}</Text>}
      <WaitingMessage currentFile={currentFile} processed={processed} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%", maxWidth: 480, alignItems: "center" },
  title: { color: COLORS.textPrimary, fontFamily: "Courier New", fontSize: 18, marginTop: 16 },
  track: { height: 12, width: "100%", backgroundColor: COLORS.bgElevated, borderWidth: 1, borderColor: COLORS.border, marginTop: 20 },
  fill: { height: "100%", backgroundColor: COLORS.amberLight },
  count: { color: COLORS.textPrimary, fontFamily: "Courier New", fontSize: 14, marginTop: 12, textAlign: "center" },
  details: { color: COLORS.textSecondary, fontFamily: "Courier New", fontSize: 14, marginTop: 8, textAlign: "center" },
  current: { color: COLORS.textPrimary, fontFamily: "Courier New", fontSize: 14, marginTop: 12, textAlign: "center" },
  hint: { color: COLORS.textMuted, fontFamily: "Courier New", fontSize: 14, lineHeight: 21, marginTop: 12, textAlign: "center" },
});
