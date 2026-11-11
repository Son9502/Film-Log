import { View, Text, StyleSheet } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { useRouter } from "expo-router";
import { useFilmLogStore } from "@/store";
import { COLORS } from "@/constants";

// Native only: react-native-maps is stubbed on web, where Journal hides the map toggle.
export function ShotMap() {
  const router = useRouter();
  const { rolls, filmStocks } = useFilmLogStore();

  const geoShots = rolls.flatMap((roll) => {
    const filmName = filmStocks.find((f) => f.id === roll.filmStockId)?.name ?? roll.filmStockId;
    const rollName = roll.name ?? filmName;
    return roll.shots
      .filter((s) => s.location)
      .map((s) => ({
        shotId: s.id,
        rollId: roll.id,
        rollName,
        frame: s.frame,
        latitude: s.location!.latitude,
        longitude: s.location!.longitude,
      }));
  });

  if (geoShots.length === 0) {
    return (
      <View style={s.empty}>
        <Text style={s.emptyIcon}>📍</Text>
        <Text style={s.emptyTitle}>No tagged shots yet</Text>
        <Text style={s.emptySub}>
          GPS is captured automatically when you log a frame.{"\n"}
          Frames with only a text location appear in the list view.
        </Text>
      </View>
    );
  }

  const lats = geoShots.map((g) => g.latitude);
  const lngs = geoShots.map((g) => g.longitude);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const pad = 0.01;
  const region = {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(maxLat - minLat, pad) * 1.4,
    longitudeDelta: Math.max(maxLng - minLng, pad) * 1.4,
  };

  return (
    <View style={s.container}>
      <MapView style={s.map} initialRegion={region}>
        {geoShots.map((g) => (
          <Marker
            key={g.shotId}
            coordinate={{ latitude: g.latitude, longitude: g.longitude }}
            onPress={() => router.push(`/roll/${g.rollId}`)}
          >
            <View style={s.bubble}>
              <Text style={s.bubbleRoll} numberOfLines={1}>{g.rollName}</Text>
              <Text style={s.bubbleFrame}>{String(g.frame).padStart(2, "0")}</Text>
            </View>
          </Marker>
        ))}
      </MapView>
      <View style={s.pill}>
        <Text style={s.pillText}>{geoShots.length} frame{geoShots.length !== 1 ? "s" : ""} tagged</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  map: { flex: 1 },

  empty: {
    flex: 1, backgroundColor: COLORS.bg,
    alignItems: "center", justifyContent: "center", padding: 32,
  },
  emptyIcon: { fontSize: 40, marginBottom: 16 },
  emptyTitle: {
    fontSize: 12, color: COLORS.amber, fontFamily: "Courier New",
    letterSpacing: 2, textTransform: "uppercase", marginBottom: 12,
  },
  emptySub: {
    fontSize: 11, color: COLORS.textDim, fontFamily: "Courier New",
    textAlign: "center", lineHeight: 18,
  },

  bubble: {
    backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.amber,
    paddingHorizontal: 8, paddingVertical: 4, maxWidth: 120,
  },
  bubbleRoll: {
    fontSize: 9, color: COLORS.textMuted, fontFamily: "Courier New",
    letterSpacing: 0.5, textTransform: "uppercase",
  },
  bubbleFrame: {
    fontSize: 13, color: COLORS.amber, fontFamily: "Courier New", fontWeight: "bold",
  },

  pill: {
    position: "absolute", bottom: 24, alignSelf: "center",
    backgroundColor: COLORS.bgElevated, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  pillText: {
    fontSize: 10, color: COLORS.textMuted, fontFamily: "Courier New",
    letterSpacing: 1.5, textTransform: "uppercase",
  },
});
