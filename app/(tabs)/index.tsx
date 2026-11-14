import { useMemo, useState } from "react";
import {
  View, Text, SectionList, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useFilmLogStore } from "@/store";
import { COLORS } from "@/constants";
import { formatDate, rollProgress, statusColors, pickableCameras } from "@/utils";
import { Roll } from "@/types";
import { ROLL_STATUS_LIST } from "@/constants";
import { filterRolls, RollFilters } from "@/utils/rollFilter";
import Dropdown from "@/components/Dropdown";

export default function RollsScreen() {
  const router = useRouter();
  const { rolls, cameras, filmStocks, hydrated, user, rollSync, syncConflicts, syncNotices, dismissSyncNotices } = useFilmLogStore();
  const [filters, setFilters] = useState<RollFilters>({});
  const [showFilters, setShowFilters] = useState(false);

  const visible = useMemo(
    () =>
      filterRolls(rolls, filters, {
        film: (id) => filmStocks.find((f) => f.id === id)?.name ?? id,
        camera: (id) => cameras.find((c) => c.id === id)?.name ?? id,
      }),
    [rolls, filters, filmStocks, cameras]
  );
  const setFilter = (patch: Partial<RollFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const activeCount = Object.entries(filters).filter(([k, v]) => k !== "query" && !!v).length;
  const sections = [
    { title: "In process", data: visible.filter((r) => r.status !== "Archived") },
    { title: "Archived", data: visible.filter((r) => r.status === "Archived") },
  ].filter((section) => section.data.length > 0);

  if (!hydrated) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={COLORS.amber} />
      </View>
    );
  }

  const getCameraName = (id: string) =>
    cameras.find((c) => c.id === id)?.name ?? id;

  const getFilmName = (id: string) =>
    filmStocks.find((f) => f.id === id)?.name ?? id;

  // Stats
  const active = rolls.filter((r) => r.status === "Shooting").length;
  const atLab = rolls.filter((r) => r.status === "To Develop" || r.status === "In Development" || r.status === "In Lab").length;
  const totalShots = rolls.reduce((n, r) => n + r.shots.length, 0);

  const renderRoll = ({ item }: { item: Roll }) => {
    const { bg, fg } = statusColors(item.status);
    const progress = rollProgress(item.shots.length, item.frameCount);
    const filmName = getFilmName(item.filmStockId);
    const cameraName = getCameraName(item.cameraId);

    return (
      <TouchableOpacity
        style={s.card}
        onPress={() => router.push(`/roll/${item.id}`)}
        activeOpacity={0.75}
      >
        <View style={s.cardHeader}>
          <View style={s.cardLeft}>
            <Text style={s.rollName}>{item.name?.trim() || filmName}</Text>
            {!!item.name?.trim() && <Text style={s.filmName}>{filmName}</Text>}
            <Text style={s.meta}>{cameraName} · ISO {item.iso}</Text>
          </View>
          <View style={s.cardRight}>
            <Text style={s.shotCount}>{item.shots.length}</Text>
            <Text style={s.shotLabel}>/ {item.frameCount} exp</Text>
          </View>
        </View>
        <View style={s.cardFooter}>
          <View style={[s.badge, { backgroundColor: bg, borderColor: fg }]}>
            <Text style={[s.badgeText, { color: fg }]}>{item.status}</Text>
          </View>
          <Text style={s.date}>Loaded {formatDate(item.loadedAt)}</Text>
          {item.backedUpAt && item.backedUpCount === item.shots.filter((x) => x.scanUri).length && item.backedUpCount > 0 && (
            <Text style={s.date}>☁ backed up</Text>
          )}
          {item.isPublic && (
            <View style={s.publicBadge}>
              <Text style={s.publicBadgeText}>Public</Text>
            </View>
          )}
        </View>
        {/* Progress bar */}
        <View style={s.progressBg}>
          <View style={[s.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.container}>
      {user && (syncConflicts.length > 0 || rollSync.state === "setup-needed" || rollSync.state === "error") && (
        <TouchableOpacity style={s.realtimeWarning} accessibilityRole="alert" onPress={() => router.push("/(tabs)/settings")}>
          <Text style={s.realtimeWarningText}>
            {syncConflicts.length > 0
              ? `${syncConflicts.length} roll or frame change${syncConflicts.length === 1 ? "" : "s"} need your choice before they can sync.`
              : rollSync.state === "setup-needed"
                ? "Roll sync isn't set up in Supabase yet. Changes stay on this device until it is."
                : `Roll sync hit a problem: ${rollSync.error ?? "unknown error"}. Changes stay on this device and will retry.`}
            {" "}Settings ›
          </Text>
        </TouchableOpacity>
      )}
      {syncNotices.length > 0 && (
        <TouchableOpacity style={s.realtimeWarning} onPress={dismissSyncNotices}>
          {syncNotices.slice(-3).map((n, i) => <Text key={i} style={s.realtimeWarningText}>{n}</Text>)}
          <Text style={s.realtimeWarningText}>Tap to dismiss.</Text>
        </TouchableOpacity>
      )}
      {/* Stats strip */}
      <View style={s.statsRow}>
        {[
          [rolls.length, "Rolls"],
          [active, "Shooting"],
          [atLab, "Developing"],
          [totalShots, "Frames"],
        ].map(([n, label]) => (
          <View key={String(label)} style={s.stat}>
            <Text style={s.statNum}>{n}</Text>
            <Text style={s.statLabel}>{label}</Text>
          </View>
        ))}
      </View>

      <View style={s.searchRow}>
        <TextInput
          style={s.searchInput}
          value={filters.query ?? ""}
          onChangeText={(query) => setFilter({ query })}
          placeholder="Search rolls, film, camera, notes…"
          placeholderTextColor={COLORS.textMuted}
        />
        <TouchableOpacity
          style={[s.filterBtn, activeCount > 0 && s.filterBtnOn]}
          onPress={() => setShowFilters((v) => !v)}
        >
          <Text style={[s.filterBtnText, activeCount > 0 && { color: COLORS.amber }]}>
            Filters{activeCount > 0 ? ` (${activeCount})` : ""}
          </Text>
        </TouchableOpacity>
      </View>
      {showFilters && (
        <View style={s.filterPanel}>
          <Dropdown
            placeholder="Any status"
            selectedId={filters.status}
            items={ROLL_STATUS_LIST.map((x) => ({ id: x, label: x }))}
            onSelect={(i) => setFilter({ status: i.id })}
          />
          <View style={{ height: 8 }} />
          <Dropdown
            placeholder="Any film stock"
            selectedId={filters.filmStockId}
            items={filmStocks.map((f) => ({ id: f.id, label: f.name }))}
            onSelect={(i) => setFilter({ filmStockId: i.id })}
          />
          <View style={{ height: 8 }} />
          <Dropdown
            placeholder="Any camera"
            selectedId={filters.cameraId}
            items={pickableCameras(cameras, rolls).map((c) => ({ id: c.id, label: c.name }))}
            onSelect={(i) => setFilter({ cameraId: i.id })}
          />
          <TextInput
            style={[s.searchInput, { marginTop: 8 }]}
            value={filters.location ?? ""}
            onChangeText={(location) => setFilter({ location })}
            placeholder="Location contains…"
            placeholderTextColor={COLORS.textMuted}
          />
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <TextInput
              style={[s.searchInput, { flex: 1 }]}
              value={filters.from ?? ""}
              onChangeText={(from) => setFilter({ from })}
              placeholder="From YYYY-MM-DD"
              placeholderTextColor={COLORS.textMuted}
            />
            <TextInput
              style={[s.searchInput, { flex: 1 }]}
              value={filters.to ?? ""}
              onChangeText={(to) => setFilter({ to })}
              placeholder="To YYYY-MM-DD"
              placeholderTextColor={COLORS.textMuted}
            />
          </View>
          <TouchableOpacity onPress={() => setFilters({ query: filters.query })} style={{ marginTop: 10 }}>
            <Text style={s.clearText}>Clear filters</Text>
          </TouchableOpacity>
        </View>
      )}

      <SectionList
        sections={sections}
        keyExtractor={(r) => r.id}
        renderItem={renderRoll}
        renderSectionHeader={({ section }) => (
          <Text style={s.sectionHeading}>{section.title} ({section.data.length})</Text>
        )}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={s.list}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyIcon}>🎞</Text>
            <Text style={s.emptyText}>
              {rolls.length > 0 ? "No rolls match your search." : "No rolls loaded yet.\nTap + to start."}
            </Text>
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity style={s.fab} onPress={() => router.push("/roll/new")}>
        <Text style={s.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  realtimeWarning: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: COLORS.bgElevated, borderBottomWidth: 1, borderColor: COLORS.amber },
  realtimeWarningText: { color: COLORS.amberLight, fontSize: 12, fontFamily: "Courier New", lineHeight: 18 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.bg },
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 12,
    flexWrap: "wrap",
  },
  stat: {},
  statNum: { fontSize: 18, fontWeight: "bold", color: COLORS.amber, fontFamily: "Courier New" },
  statLabel: { fontSize: 12, color: COLORS.textMuted, letterSpacing: 0.5, textTransform: "uppercase", fontFamily: "Courier New" },
  searchRow: { flexDirection: "row", gap: 8, padding: 12, paddingBottom: 0 },
  searchInput: {
    flex: 1, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard,
    color: COLORS.textPrimary, paddingHorizontal: 12, paddingVertical: 8,
    minWidth: 0, minHeight: 44, fontSize: 16, fontFamily: "Courier New",
  },
  filterBtn: { borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 12, justifyContent: "center" },
  filterBtnOn: { borderColor: COLORS.amber },
  filterBtnText: { fontSize: 13, color: COLORS.textSecondary, fontFamily: "Courier New", letterSpacing: 0.5, textTransform: "uppercase" },
  filterPanel: { padding: 12, paddingBottom: 0 },
  clearText: { fontSize: 14, color: COLORS.amberLight, fontFamily: "Courier New", letterSpacing: 1 },
  list: { padding: 16, paddingBottom: 100 },
  sectionHeading: { fontSize: 16, color: COLORS.amberLight, fontFamily: "Courier New", marginBottom: 12, marginTop: 6 },
  card: {
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
    padding: 14,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  cardLeft: { flex: 1, paddingRight: 8 },
  cardRight: { alignItems: "flex-end" },
  rollName: { fontSize: 18, fontWeight: "bold", color: COLORS.textPrimary, marginBottom: 2, fontFamily: "Courier New" },
  filmName: { fontSize: 14, color: COLORS.textSecondary, fontFamily: "Courier New" },
  meta: { fontSize: 14, color: COLORS.textMuted, marginTop: 2, fontFamily: "Courier New" },
  shotCount: { fontSize: 22, fontWeight: "bold", color: COLORS.amber, fontFamily: "Courier New" },
  shotLabel: { fontSize: 12, color: COLORS.textMuted, letterSpacing: 0.5, fontFamily: "Courier New" },
  cardFooter: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  badge: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 12, letterSpacing: 0.5, textTransform: "uppercase", fontFamily: "Courier New" },
  date: { fontSize: 12, color: COLORS.textMuted, fontFamily: "Courier New" },
  publicBadge: { borderWidth: 1, borderColor: COLORS.amber, paddingHorizontal: 6, paddingVertical: 2 },
  publicBadgeText: { fontSize: 12, color: COLORS.amberLight, fontFamily: "Courier New", letterSpacing: 0.5 },
  progressBg: { height: 2, backgroundColor: COLORS.bgElevated },
  progressFill: { height: "100%", backgroundColor: COLORS.amber },
  empty: { alignItems: "center", paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 14, color: COLORS.textMuted, textAlign: "center", lineHeight: 20, fontFamily: "Courier New", letterSpacing: 1 },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.amber,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: COLORS.amber,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  fabText: { fontSize: 28, color: COLORS.bg, fontWeight: "bold", lineHeight: 32 },
});
