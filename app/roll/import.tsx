import { useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity, Image, ScrollView,
  StyleSheet, Modal,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { Directory, File, Paths } from "expo-file-system";
import { pickScansFromFiles, pickScansFromPhotos } from "@/utils/pickScans";
import { unzipSync } from "fflate";
import { useFilmLogStore } from "@/store";
import { COLORS } from "@/constants";
import { uploadScan } from "@/services/supabase";
import ScanUploadProgress from "@/components/ScanUploadProgress";
import { backOrReplace } from "@/utils/navigation";
import { useScanImportFrames } from "@/utils/useScanImportFrames";
import { assignScanFrames, identifyScanFiles } from "@/utils/scanImport";

const IMAGE_EXTS = /\.(jpg|jpeg|png|heic|heif|tiff|tif)$/i;

type FileEntry = { id: string; name: string; uri: string };
type Assignments = Record<string, number | null>;

export default function ImportScansScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { rolls, updateShot, user } = useFilmLogStore();
  const { create, creating } = useScanImportFrames();

  const roll = rolls.find((r) => r.id === id);

  const [step, setStep] = useState<"pick" | "preview" | "uploading" | "done">("pick");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [assignments, setAssignments] = useState<Assignments>({});
  const [assigningFile, setAssigningFile] = useState<string | null>(null);
  const [uploadDone, setUploadDone] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [uploadFailed, setUploadFailed] = useState(0);
  const [currentFile, setCurrentFile] = useState<string>();
  const [failures, setFailures] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  if (!roll) {
    return (
      <View style={s.center}>
        <Text style={s.muted}>Roll not found.</Text>
      </View>
    );
  }

  const sortedShots = [...roll.shots].sort((a, b) => a.frame - b.frame);
  const frameNumbers = sortedShots.map((sh) => sh.frame);

  // The lab skipped a frame: push this photo and every later one down one logged frame.
  function skipFrameBefore(fileId: string) {
    const start = files.findIndex((f) => f.id === fileId);
    if (start < 0) return;
    setAssignments((prev) => {
      const next = { ...prev };
      files.slice(start).forEach((f) => {
        const cur = next[f.id];
        const pos = cur === null ? -1 : frameNumbers.indexOf(cur);
        next[f.id] = pos >= 0 ? frameNumbers[pos + 1] ?? null : null;
      });
      return next;
    });
    setAssigningFile(null);
  }

  async function createFramesForPhotos() {
    setError(null);
    try {
      const result = await create(roll!.id, files.map((file) => file.id), frameNumbers, assignments);
      if (result) setAssignments(result);
    } catch (e: unknown) {
      console.error("Could not create scan frames:", e);
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function pickZip() {
    setError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      // fflate's async unzip needs Web Workers, which React Native lacks, so unzip synchronously.
      const zipBytes = await new File(result.assets[0].uri).bytes();
      const unzipped = unzipSync(zipBytes, {
        filter: (entry) => IMAGE_EXTS.test(entry.name) && !entry.name.startsWith("__MACOSX"),
      });

      const destDir = new Directory(Paths.cache, `import_${Date.now()}`);
      destDir.create({ intermediates: true });

      const imageFiles = identifyScanFiles(Object.entries(unzipped)
        .map(([path, data]) => ({ name: path.split("/").pop() ?? path, data }))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })))
        .map(({ id, name, data }) => {
          const file = new File(destDir, `${id}_${name}`);
          file.write(data);
          return { id, name, uri: file.uri };
        });

      if (imageFiles.length === 0) {
        setError("No image files found in the ZIP.");
        return;
      }

      setFiles(imageFiles);
      setAssignments(assignScanFrames(imageFiles, frameNumbers));
      setStep("preview");
    } catch (e: any) {
      setError(e.message ?? "Failed to read ZIP file.");
    }
  }

  async function pickImages(source: "photos" | "files") {
    setError(null);
    try {
      const picked = source === "photos" ? await pickScansFromPhotos(true) : await pickScansFromFiles(true);
      if (!picked) return;

      if (picked.length === 0) {
        setError("No images selected.");
        return;
      }

      // Files keep their names, so sort them like a ZIP; Photos keeps the order you tapped.
      const ordered = source === "files"
        ? [...picked].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }))
        : picked;
      const imageFiles: FileEntry[] = identifyScanFiles(ordered);

      setFiles(imageFiles);
      setAssignments(assignScanFrames(imageFiles, frameNumbers));
      setStep("preview");
    } catch (e: any) {
      setError(e.message ?? "Failed to pick photos.");
    }
  }

  async function confirmImport() {
    if (!user) {
      setError("Sign in required to upload scans.");
      return;
    }

    const toUpload = files.filter((f) => assignments[f.id] != null);
    if (toUpload.length === 0) {
      setError("Assign at least one file to a frame.");
      return;
    }

    setStep("uploading");
    setUploadTotal(toUpload.length);
    setUploadDone(0);
    setUploadFailed(0);
    setFailures([]);

    const r = roll!;
    let done = 0;
    let failed = 0;
    for (const file of toUpload) {
      setCurrentFile(file.name);
      const frameNum = assignments[file.id];
      // Read the frame fresh: sync may have merged changes from another device mid-import.
      const shot = useFilmLogStore.getState().rolls.find((x) => x.id === r.id)?.shots.find((sh) => sh.frame === frameNum);
      try {
        if (!shot) throw new Error("The assigned frame no longer exists.");
        const path = await uploadScan(user.id, r.id, shot.id, file.uri);
        updateShot(r.id, { ...shot, scanUri: path });
        done++;
        setUploadDone(done);
      } catch (e: unknown) {
        console.error(`Upload failed for frame ${frameNum}:`, e);
        const message = e instanceof Error ? e.message : String(e);
        setFailures((previous) => [...previous, `${file.name}: ${message}`]);
        failed++;
        setUploadFailed(failed);
      }
    }

    setStep("done");
  }

  function assignFrame(fileId: string, frame: number | null) {
    setAssignments((prev) => {
      const next = { ...prev };
      if (frame !== null) {
        const prevOwner = Object.keys(next).find(
          (k) => k !== fileId && next[k] === frame,
        );
        if (prevOwner) next[prevOwner] = null;
      }
      next[fileId] = frame;
      return next;
    });
    setAssigningFile(null);
  }

  // ── Done ──────────────────────────────────────────────────────────────────────
  if (step === "done") {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: COLORS.bg }} contentContainerStyle={[s.center, { flex: 0, flexGrow: 1 }]}>
        <Text style={s.doneTitle}>{uploadFailed > 0 ? (uploadDone > 0 ? "Import Partially Complete" : "Import Failed") : "Import Complete"}</Text>
        <Text style={s.doneSub}>
          {uploadDone} scan{uploadDone !== 1 ? "s" : ""} uploaded.
          {uploadFailed > 0 && `\n${uploadFailed} failed — check your connection and Supabase storage bucket.`}
          {"\nFrame metadata sync is separate; verify your scans on another device before deleting originals."}
        </Text>
        {failures.map((failure, index) => <Text key={index} style={s.error}>{failure}</Text>)}
        <TouchableOpacity style={s.btnBlock} onPress={() => backOrReplace(router, { pathname: "/roll/[id]", params: { id: roll.id } })}>
          <Text style={s.btnText}>Back to Roll</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ── Uploading ─────────────────────────────────────────────────────────────────
  if (step === "uploading") {
    return (
      <View style={s.center}>
        <ScanUploadProgress uploaded={uploadDone} failed={uploadFailed} total={uploadTotal} currentFile={currentFile} />
      </View>
    );
  }

  // ── Pick ──────────────────────────────────────────────────────────────────────
  if (step === "pick") {
    return (
      <View style={s.container}>
        <Text style={s.sectionTitle}>Import Scans</Text>
        <Text style={s.instructions}>
          Choose how to import scans for this roll. Files will be sorted alphabetically
          and matched to frames in order — you can reassign them before uploading.
        </Text>
        {error && <Text style={s.error}>{error}</Text>}
        <TouchableOpacity
          style={s.optionBtn}
          onPress={pickZip}
        >
          <Text style={s.optionBtnTitle}>Select ZIP File</Text>
          <Text style={s.optionBtnSub}>Extract and import a ZIP of scan images</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.optionBtn}
          onPress={() => pickImages("files")}
        >
          <Text style={s.optionBtnTitle}>Select Files</Text>
          <Text style={s.optionBtnSub}>Originals from Files or iCloud Drive, sorted by file name</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.optionBtn}
          onPress={() => pickImages("photos")}
        >
          <Text style={s.optionBtnTitle}>Select From Photos</Text>
          <Text style={s.optionBtnSub}>Pick images from your library, in the order you tap them</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Preview / assignment ──────────────────────────────────────────────────────
  const assignedCount = Object.values(assignments).filter((v) => v !== null).length;
  const unassignedFiles = files.length - assignedCount;
  const framesWithoutScan = frameNumbers.length - assignedCount;

  return (
    <View style={s.container}>
      <FlatList
        data={files}
        keyExtractor={(f) => f.id}
        contentContainerStyle={s.listContent}
        ListHeaderComponent={
          <>
            <Text style={s.sectionTitle}>Assign Scans to Frames</Text>

            {/* Mismatch warning */}
            {files.length !== frameNumbers.length && (
              <View style={s.mismatchBanner}>
                {files.length > frameNumbers.length ? (
                  <Text style={s.mismatchText}>
                    {files.length} photos · {frameNumbers.length} frame{frameNumbers.length === 1 ? "" : "s"} —{" "}
                    <Text style={s.mismatchHighlight}>
                      {unassignedFiles} photo{unassignedFiles !== 1 ? "s" : ""} won't be imported
                    </Text>
                    . Tap rows to reassign, or create the missing frames.
                  </Text>
                ) : (
                  <Text style={s.mismatchText}>
                    {files.length} photos · {frameNumbers.length} frame{frameNumbers.length === 1 ? "" : "s"} —{" "}
                    <Text style={s.mismatchHighlight}>
                      {framesWithoutScan} frame{framesWithoutScan !== 1 ? "s" : ""} won't have a scan
                    </Text>
                    . If the lab skipped a frame, tap the first photo after the gap and choose "Skip a frame".
                  </Text>
                )}
                {files.length > frameNumbers.length && (
                  <TouchableOpacity style={s.createFramesBtn} onPress={createFramesForPhotos} disabled={creating}>
                    <Text style={s.createFramesText}>
                      {creating ? "Creating frames…" : `Create ${files.length - frameNumbers.length} missing frame${files.length - frameNumbers.length === 1 ? "" : "s"}`}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <Text style={s.instructions}>
              Tap a row to change its frame assignment. Unassigned photos won't be uploaded.
            </Text>
          </>
        }
        renderItem={({ item }) => {
          const frame = assignments[item.id];
          return (
            <TouchableOpacity style={s.fileRow} onPress={() => setAssigningFile(item.id)} disabled={creating}>
              <Image source={{ uri: item.uri }} style={s.fileThumb} resizeMode="contain" />
              <View style={s.fileInfo}>
                <Text style={s.fileName} numberOfLines={1}>{item.name}</Text>
                <Text style={frame !== null ? s.frameAssigned : s.frameUnassigned}>
                  {frame !== null ? `Frame ${frame}` : "Unassigned — tap to assign"}
                </Text>
              </View>
              <Text style={s.chevron}>›</Text>
            </TouchableOpacity>
          );
        }}
        ListFooterComponent={
          <View style={s.footer}>
            {error && <Text style={s.error}>{error}</Text>}
            <View style={s.footerBtns}>
              <TouchableOpacity style={s.btnSecondary} onPress={() => setStep("pick")} disabled={creating}>
                <Text style={s.btnSecondaryText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, creating && s.btnDisabled]} onPress={confirmImport} disabled={creating}>
                <Text style={s.btnText}>
                  Upload {assignedCount} Scan{assignedCount !== 1 ? "s" : ""}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        }
      />

      {/* Frame assignment picker */}
      <Modal
        visible={assigningFile !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setAssigningFile(null)}
      >
        <View style={s.pickerOverlay}>
          <View style={s.pickerSheet}>
            <Text style={s.pickerTitle}>Assign to Frame</Text>
            <TouchableOpacity
              style={s.pickerOption}
              onPress={() => assigningFile && skipFrameBefore(assigningFile)}
            >
              <Text style={s.pickerOptionText}>Skip a frame before this photo</Text>
              <Text style={s.pickerOptionSub}>Moves this photo and all later ones down one frame</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.pickerOption}
              onPress={() => assigningFile && assignFrame(assigningFile, null)}
            >
              <Text style={s.pickerOptionMuted}>Unassigned</Text>
            </TouchableOpacity>
            {frameNumbers.map((fn) => {
              const isCurrentFile = assigningFile !== null && assignments[assigningFile] === fn;
              const takenBy = Object.keys(assignments).find(
                (k) => k !== assigningFile && assignments[k] === fn,
              );
              return (
                <TouchableOpacity
                  key={fn}
                  style={[s.pickerOption, isCurrentFile && s.pickerOptionActive]}
                  onPress={() => assigningFile && assignFrame(assigningFile, fn)}
                >
                  <Text style={[s.pickerOptionText, isCurrentFile && s.pickerOptionTextActive]}>
                    Frame {fn}
                  </Text>
                  {takenBy && !isCurrentFile && (
                    <Text style={s.pickerOptionSub} numberOfLines={1}>
                      Currently: {files.find((file) => file.id === takenBy)?.name}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={s.pickerCancel} onPress={() => setAssigningFile(null)}>
              <Text style={s.pickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 16 },
  center: { flex: 1, backgroundColor: COLORS.bg, justifyContent: "center", alignItems: "center", padding: 24 },
  listContent: { paddingBottom: 32 },

  sectionTitle: {
    fontSize: 16, color: COLORS.amberLight, letterSpacing: 1, textTransform: "uppercase",
    fontFamily: "Courier New", marginBottom: 10, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  instructions: {
    fontSize: 15, color: COLORS.textMuted, fontFamily: "Courier New",
    lineHeight: 22, marginBottom: 16,
  },
  warning: { fontSize: 14, color: COLORS.amberLight, fontFamily: "Courier New", marginBottom: 16 },
  error: { fontSize: 14, color: "#ff9588", fontFamily: "Courier New", marginBottom: 12, lineHeight: 20 },
  muted: { fontSize: 15, color: COLORS.textMuted, fontFamily: "Courier New" },

  optionBtn: {
    borderWidth: 1, borderColor: COLORS.border,
    padding: 16, marginBottom: 12, backgroundColor: COLORS.bgCard,
  },
  optionBtnTitle: { fontSize: 16, color: COLORS.textPrimary, fontFamily: "Courier New", marginBottom: 4 },
  optionBtnSub: { fontSize: 14, color: COLORS.textMuted, fontFamily: "Courier New" },

  mismatchBanner: {
    borderWidth: 1, borderColor: COLORS.amberDim,
    backgroundColor: COLORS.bgCard, padding: 12, marginBottom: 12,
  },
  mismatchText: { fontSize: 14, color: COLORS.textMuted, fontFamily: "Courier New", lineHeight: 21 },
  createFramesBtn: { marginTop: 10, borderWidth: 1, borderColor: COLORS.amber, paddingVertical: 8, alignItems: "center" },
  createFramesText: { fontSize: 14, color: COLORS.amberLight, fontFamily: "Courier New", letterSpacing: 0.5, textAlign: "center" },
  mismatchHighlight: { color: COLORS.amber },

  btn: { flex: 1, backgroundColor: COLORS.amber, paddingVertical: 14, alignItems: "center" },
  btnBlock: { backgroundColor: COLORS.amber, paddingVertical: 14, paddingHorizontal: 40, alignItems: "center" },
  btnText: { color: COLORS.bg, fontFamily: "Courier New", fontSize: 14, letterSpacing: 1, textTransform: "uppercase", fontWeight: "bold" },
  btnDisabled: { opacity: 0.4 },
  btnSecondary: { flex: 1, borderWidth: 1, borderColor: COLORS.border, paddingVertical: 14, alignItems: "center", marginRight: 12 },
  btnSecondaryText: { color: COLORS.textMuted, fontFamily: "Courier New", fontSize: 14, letterSpacing: 1, textTransform: "uppercase" },

  fileRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle,
  },
  fileThumb: { width: 52, height: 52, backgroundColor: COLORS.bgCard },
  fileInfo: { flex: 1 },
  fileName: { fontSize: 14, color: COLORS.textPrimary, fontFamily: "Courier New" },
  frameAssigned: { fontSize: 14, color: COLORS.amberLight, fontFamily: "Courier New", marginTop: 3 },
  frameUnassigned: { fontSize: 14, color: COLORS.textDim, fontFamily: "Courier New", marginTop: 3 },
  chevron: { fontSize: 18, color: COLORS.textDim },

  footer: { paddingTop: 20 },
  footerBtns: { flexDirection: "row" },

  doneTitle: { fontSize: 16, color: COLORS.amber, fontFamily: "Courier New", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 },
  doneSub: { fontSize: 14, color: COLORS.textMuted, fontFamily: "Courier New", lineHeight: 21, marginBottom: 24 },

  pickerOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
  pickerSheet: {
    backgroundColor: COLORS.bgElevated, borderTopWidth: 1,
    borderTopColor: COLORS.border, paddingTop: 20, paddingBottom: 40, maxHeight: "80%",
  },
  pickerTitle: {
    fontSize: 15, color: COLORS.amberLight, letterSpacing: 1, textTransform: "uppercase",
    fontFamily: "Courier New", marginBottom: 8, paddingHorizontal: 20,
  },
  pickerOption: {
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle,
  },
  pickerOptionActive: { backgroundColor: COLORS.bgCard },
  pickerOptionText: { fontSize: 13, color: COLORS.textSecondary, fontFamily: "Courier New" },
  pickerOptionTextActive: { color: COLORS.amber },
  pickerOptionSub: { fontSize: 13, color: COLORS.textDim, fontFamily: "Courier New", marginTop: 2 },
  pickerOptionMuted: { fontSize: 13, color: COLORS.textDim, fontFamily: "Courier New" },
  pickerCancel: { paddingVertical: 16, alignItems: "center" },
  pickerCancelText: { fontSize: 14, color: COLORS.textMuted, fontFamily: "Courier New", letterSpacing: 1 },
});
